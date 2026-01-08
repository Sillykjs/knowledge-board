<template>
  <div
    class="note-wall"
    @dragover.prevent
    @drop="onDrop"
    @mousedown="onWallMouseDown"
    @mousemove="onWallMouseMove"
    @mouseup="onWallMouseUp"
    @mouseleave="onWallMouseUp"
    @wheel.prevent="onWheel"
  >
    <!-- 固定标题（在白板外部，不受缩放平移影响） -->
    <div class="title-container">
      <h1
        class="wall-title"
        @dblclick="openEditModal"
        @mouseenter="showTooltip = true"
        @mouseleave="showTooltip = false"
      >
        {{ title }}
        <div
          v-if="showTooltip"
          class="tooltip"
        >
          {{ remark }}
        </div>
      </h1>
    </div>

    <!-- 白板内容变换层 -->
    <div class="wall-content" :style="wallTransformStyle">
      <!-- SVG连线层（在便签下方） -->
      <svg class="connections-layer" :style="layerStyle">
        <!-- 已建立的连接 -->
        <line
          v-for="connection in connections"
          :key="connection.id"
          :x1="getConnectionStartPoint(connection).x"
          :y1="getConnectionStartPoint(connection).y"
          :x2="getConnectionEndPoint(connection).x"
          :y2="getConnectionEndPoint(connection).y"
          :class="['connection-line', { selected: selectedConnectionId === connection.id }]"
          @click="selectConnection(connection.id)"
        />
        <!-- 箭头 -->
        <polygon
          v-for="connection in connections"
          :key="'arrow-' + connection.id"
          :points="getArrowheadPoints(connection)"
          class="connection-arrowhead"
          :class="{ selected: selectedConnectionId === connection.id }"
          @click="selectConnection(connection.id)"
        />
        <!-- 拖拽中的临时连线 -->
        <line
          v-if="isDraggingConnection && currentMousePos"
          :x1="dragStartPoint.x"
          :y1="dragStartPoint.y"
          :x2="currentMousePos.x"
          :y2="currentMousePos.y"
          class="temp-connection-line"
        />
      </svg>

      <Note
        v-for="note in notes"
        :key="note.id"
        :id="note.id"
        :title="note.title"
        :content="note.content"
        :position_x="note.position_x"
        :position_y="note.position_y"
        @update="onNoteUpdate"
        @delete="onNoteDelete"
        @connection-start="onConnectionStart"
      />
    </div>

    <button class="add-button" @click="addNote">
      <span class="plus-icon">+</span>
    </button>

    <button class="recycle-button" @click="openRecycleBin">
      <span class="recycle-icon">🗑️</span>
      <span v-if="recycleCount > 0" class="recycle-count">{{ recycleCount }}</span>
    </button>

    <!-- 缩放控制按钮组 -->
    <div class="zoom-controls">
      <button class="zoom-btn" @click="zoomIn" title="放大">
        <span>+</span>
      </button>
      <button class="zoom-btn" @click="zoomOut" title="缩小">
        <span>-</span>
      </button>
      <button class="zoom-btn reset" @click="resetView" title="重置视图">
        <span>⟲</span>
      </button>
      <div class="zoom-level">{{ Math.round(viewport.scale * 100) }}%</div>
    </div>

    <!-- Recycle Bin Modal -->
    <div v-if="showRecycleBin" class="recycle-modal" @click="closeRecycleModalOutside">
      <div class="recycle-modal-content" @click.stop>
        <div class="recycle-header">
          <h3>回收站</h3>
          <button class="close-btn" @click="closeRecycleBin">×</button>
        </div>

        <div class="recycle-body">
          <div v-if="recycleNotes.length === 0" class="empty-recycle">
            <div class="empty-icon">🗑️</div>
            <p>回收站为空</p>
          </div>

          <div v-else class="recycle-list">
            <div
              v-for="note in recycleNotes"
              :key="note.id"
              class="recycle-item"
            >
              <div class="recycle-item-content">
                <h4 class="recycle-item-title">{{ note.title }}</h4>
                <p class="recycle-item-text">{{ note.content }}</p>
                <p class="recycle-item-time">删除于 {{ formatDeletedTime(note.deleted_at) }}</p>
              </div>
              <div class="recycle-item-actions">
                <button @click="restoreNote(note.id)" class="btn-restore">↩️ 恢复</button>
                <button @click="permanentDelete(note.id)" class="btn-permanent-delete">🗑️ 永久删除</button>
              </div>
            </div>
          </div>
        </div>

        <div class="recycle-footer">
          <button v-if="recycleNotes.length > 0" @click="clearRecycleBin" class="btn-clear-all">
            清空回收站
          </button>
          <button @click="closeRecycleBin" class="btn-close">关闭</button>
        </div>
      </div>
    </div>

    <!-- Edit Title Modal -->
    <div v-if="isEditingTitle" class="modal-overlay">
      <div class="modal-content">
        <h3>编辑标题和备注</h3>
        <div class="form-group">
          <label>标题:</label>
          <input v-model="tempTitle" type="text" class="form-input" />
        </div>
        <div class="form-group">
          <label>备注:</label>
          <textarea v-model="tempRemark" class="form-input" rows="3"></textarea>
        </div>
        <div class="modal-buttons">
          <button @click="cancelEdit" class="btn-cancel">取消</button>
          <button @click="saveTitleAndRemark" class="btn-save">保存</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="modal-overlay confirm-modal-overlay">
      <div class="modal-content">
        <h3>确认永久删除</h3>
        <p class="confirm-message">确定要永久删除此便签吗？此操作无法撤销。</p>
        <div class="modal-buttons">
          <button @click="cancelPermanentDelete" class="btn-cancel">取消</button>
          <button @click="confirmPermanentDelete" class="btn-delete">确认删除</button>
        </div>
      </div>
    </div>

    <!-- Clear Recycle Bin Confirmation Modal -->
    <div v-if="showClearConfirm" class="modal-overlay confirm-modal-overlay">
      <div class="modal-content">
        <h3>确认清空回收站</h3>
        <p class="confirm-message">确定要清空回收站吗？这将永久删除 {{ recycleCount }} 个便签，此操作无法撤销。</p>
        <div class="modal-buttons">
          <button @click="cancelClearRecycleBin" class="btn-cancel">取消</button>
          <button @click="confirmClearRecycleBin" class="btn-delete">确认清空</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import Note from './Note.vue';

export default {
  name: 'NoteWall',
  components: {
    Note
  },
  data() {
    return {
      notes: [],
      title: '便签墙',
      remark: '这是便签墙的备注信息',
      tempTitle: '',
      tempRemark: '',
      showTooltip: false,
      isEditingTitle: false,
      showRecycleBin: false,
      recycleNotes: [],
      recycleCount: 0,
      showDeleteConfirm: false,
      pendingDeleteNoteId: null,
      showClearConfirm: false,
      connections: [],              // 所有连接关系
      isDraggingConnection: false,  // 是否正在拖拽连线
      dragStartNoteId: null,        // 拖拽起始便签ID
      dragStartPoint: null,         // 拖拽起始点坐标 {x, y}
      currentMousePos: null,        // 当前鼠标坐标
      selectedConnectionId: null,   // 选中的连接ID（用于删除）
      // 白板视口状态
      viewport: {
        scale: 1,           // 缩放比例 (0.25 ~ 3.0)
        translateX: 0,      // 平移X（像素）
        translateY: 0,      // 平移Y（像素）
        isDragging: false,  // 是否正在拖拽白板
        lastMouseX: 0,      // 上次鼠标X位置
        lastMouseY: 0       // 上次鼠标Y位置
      },
      // 缩放限制
      zoomLimits: {
        min: 0.25,
        max: 3.0,
        step: 0.1
      }
    };
  },
  mounted() {
    this.loadNotes();
    this.loadRecycleNotes();
    this.loadWallConfig();
    this.loadConnections();

    // 添加键盘事件监听
    document.addEventListener('keydown', this.onKeyDown);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
  },
  computed: {
    layerStyle() {
      return {
        width: '100%',
        height: '100%'
      };
    },
    // 白板变换样式
    wallTransformStyle() {
      return {
        transform: `translate(${this.viewport.translateX}px, ${this.viewport.translateY}px) scale(${this.viewport.scale})`,
        transformOrigin: '0 0'  // 从左上角开始变换
      };
    }
  },
  methods: {
    // 坐标转换方法
    // 屏幕坐标转世界坐标
    screenToWorld(screenX, screenY) {
      return {
        x: (screenX - this.viewport.translateX) / this.viewport.scale,
        y: (screenY - this.viewport.translateY) / this.viewport.scale
      };
    },
    // 世界坐标转屏幕坐标
    worldToScreen(worldX, worldY) {
      return {
        x: worldX * this.viewport.scale + this.viewport.translateX,
        y: worldY * this.viewport.scale + this.viewport.translateY
      };
    },
    // 白板拖拽方法
    // 白板鼠标按下事件
    onWallMouseDown(event) {
      // 响应左键（button === 0）和中键（button === 1）
      if (event.button === 0 || event.button === 1) {
        // 确保不是点击在便签或连接点上
        if (event.target.closest('.note') || event.target.closest('.connection-point')) {
          return;
        }

        // 如果是左键，阻止默认行为并启动白板拖拽
        // 如果是中键，preventDefault() 防止滚动
        event.preventDefault();

        this.viewport.isDragging = true;
        this.viewport.lastMouseX = event.clientX;
        this.viewport.lastMouseY = event.clientY;
      }
    },
    // 白板鼠标移动事件
    onWallMouseMove(event) {
      if (!this.viewport.isDragging) return;

      const deltaX = event.clientX - this.viewport.lastMouseX;
      const deltaY = event.clientY - this.viewport.lastMouseY;

      this.viewport.translateX += deltaX;
      this.viewport.translateY += deltaY;
      this.viewport.lastMouseX = event.clientX;
      this.viewport.lastMouseY = event.clientY;
    },
    // 白板鼠标抬起事件
    onWallMouseUp(event) {
      if (this.viewport.isDragging) {
        this.viewport.isDragging = false;
      }
    },
    // 滚轮缩放方法
    // 滚轮事件处理
    onWheel(event) {
      // 以鼠标位置为中心缩放
      this.zoomAtPoint(event.clientX, event.clientY, event.deltaY);
    },
    // 在指定点进行缩放
    zoomAtPoint(screenX, screenY, delta) {
      // 归一化 delta 值（通常每个滚动刻度是 100，我们将其映射到合理范围）
      // 向上滚动 delta < 0，向下滚动 delta > 0
      const direction = delta > 0 ? -1 : 1;
      const zoomFactor = direction * this.zoomLimits.step;

      const newScale = Math.min(
        this.zoomLimits.max,
        Math.max(this.zoomLimits.min, this.viewport.scale + zoomFactor)
      );

      if (newScale === this.viewport.scale) return;

      // 计算缩放前的世界坐标
      const worldX = (screenX - this.viewport.translateX) / this.viewport.scale;
      const worldY = (screenY - this.viewport.translateY) / this.viewport.scale;

      // 应用新缩放
      this.viewport.scale = newScale;

      // 调整平移量，保持缩放点位置不变
      this.viewport.translateX = screenX - worldX * this.viewport.scale;
      this.viewport.translateY = screenY - worldY * this.viewport.scale;
    },
    // 放大按钮
    zoomIn() {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      this.zoomAtPoint(centerX, centerY, -100);
    },
    // 缩小按钮
    zoomOut() {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      this.zoomAtPoint(centerX, centerY, 100);
    },
    // 重置视图
    resetView() {
      this.viewport.scale = 1;
      this.viewport.translateX = 0;
      this.viewport.translateY = 0;
    },
    async loadWallConfig() {
      try {
        const response = await axios.get('/api/notes/config');
        this.title = response.data.title;
        this.remark = response.data.remark;
        // Initialize temp variables with current values
        this.tempTitle = this.title;
        this.tempRemark = this.remark;
      } catch (error) {
        console.error('Failed to load wall config:', error);
        // 如果加载失败，使用默认值
        this.title = '便签墙';
        this.remark = '这是便签墙的备注信息';
        this.tempTitle = this.title;
        this.tempRemark = this.remark;
      }
    },
    async loadNotes() {
      try {
        const response = await axios.get('/api/notes');
        this.notes = response.data.notes;
      } catch (error) {
        console.error('Failed to load notes:', error);
      }
    },
    async addNote() {
      const newPosition = this.calculateNewPosition();

      try {
        const response = await axios.post('/api/notes', {
          title: '新便签',
          content: '点击编辑添加内容',
          position_x: newPosition.x,
          position_y: newPosition.y
        });

        this.notes.push(response.data.note);
      } catch (error) {
        console.error('Failed to create note:', error);
      }
    },
    calculateNewPosition() {
      const offsetX = (this.notes.length % 5) * 270 + 50;
      const offsetY = Math.floor(this.notes.length / 5) * 200 + 150;
      return { x: offsetX, y: offsetY };
    },
    onNoteUpdate(updatedNote) {
      const index = this.notes.findIndex(n => n.id === updatedNote.id);
      if (index !== -1) {
        // 使用 Vue 3 的响应式方式更新数组
        this.notes.splice(index, 1, { ...updatedNote });
        // 强制连接线重新计算（通过重新触发响应式更新）
        this.$forceUpdate();
      }
    },
    onNoteDelete(noteId) {
      this.notes = this.notes.filter(n => n.id !== noteId);
      this.loadRecycleNotes();
      this.loadConnections();  // 后端会自动删除相关连接
    },
    onDrop(e) {
      e.preventDefault();
    },
    openEditModal() {
      // Initialize temp values with current values when opening the modal
      this.tempTitle = this.title;
      this.tempRemark = this.remark;
      this.isEditingTitle = true;
    },
    async saveTitleAndRemark() {
      try {
        // 调用后端 API 保存配置
        await axios.put('/api/notes/config', {
          title: this.tempTitle,
          remark: this.tempRemark
        });

        // 更新实际的标题和备注
        this.title = this.tempTitle;
        this.remark = this.tempRemark;
        this.isEditingTitle = false;
      } catch (error) {
        console.error('Failed to save wall config:', error);
        alert('保存失败，请重试');
      }
    },
    cancelEdit() {
      // Reset temp values to current saved values
      this.tempTitle = this.title;
      this.tempRemark = this.remark;
      this.isEditingTitle = false;
    },
    // Recycle bin methods
    async openRecycleBin() {
      this.showRecycleBin = true;
      await this.loadRecycleNotes();
    },
    closeRecycleBin() {
      this.showRecycleBin = false;
    },
    async loadRecycleNotes() {
      try {
        const response = await axios.get('/api/notes/recycle-bin');
        this.recycleNotes = response.data.notes;
        this.recycleCount = this.recycleNotes.length;
      } catch (error) {
        console.error('Failed to load recycle bin:', error);
      }
    },
    async restoreNote(noteId) {
      try {
        await axios.post(`/api/notes/recycle-bin/restore/${noteId}`);
        this.recycleNotes = this.recycleNotes.filter(n => n.id !== noteId);
        this.recycleCount = this.recycleNotes.length;
        await this.loadNotes();
      } catch (error) {
        console.error('Failed to restore note:', error);
      }
    },
    permanentDelete(noteId) {
      this.pendingDeleteNoteId = noteId;
      this.showDeleteConfirm = true;
    },
    async confirmPermanentDelete() {
      const noteId = this.pendingDeleteNoteId;
      this.showDeleteConfirm = false;
      this.pendingDeleteNoteId = null;

      if (!noteId) return;

      try {
        await axios.delete(`/api/notes/recycle-bin/${noteId}`);
        this.recycleNotes = this.recycleNotes.filter(n => n.id !== noteId);
        this.recycleCount = this.recycleNotes.length;
      } catch (error) {
        console.error('Failed to permanently delete note:', error);
      }
    },
    cancelPermanentDelete() {
      this.showDeleteConfirm = false;
      this.pendingDeleteNoteId = null;
    },
    clearRecycleBin() {
      this.showClearConfirm = true;
    },
    async confirmClearRecycleBin() {
      this.showClearConfirm = false;

      try {
        await axios.delete('/api/notes/recycle-bin');
        this.recycleNotes = [];
        this.recycleCount = 0;
      } catch (error) {
        console.error('Failed to clear recycle bin:', error);
      }
    },
    cancelClearRecycleBin() {
      this.showClearConfirm = false;
    },
    formatDeletedTime(deletedAt) {
      const date = new Date(deletedAt);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return '刚刚';
      if (diffMins < 60) return `${diffMins} 分钟前`;
      if (diffHours < 24) return `${diffHours} 小时前`;
      if (diffDays < 7) return `${diffDays} 天前`;

      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    },
    closeRecycleModalOutside(event) {
      if (event.target === event.currentTarget) {
        this.closeRecycleBin();
      }
    },

    // ========== 连接相关方法 ==========

    // 加载所有连接
    async loadConnections() {
      try {
        const response = await axios.get('/api/notes/connections');
        this.connections = response.data.connections;
      } catch (error) {
        console.error('Failed to load connections:', error);
      }
    },

    // 开始连接拖拽
    onConnectionStart(payload) {
      const { noteId, type, event } = payload;

      // 只允许从引出点开始拖拽
      if (type !== 'output') return;

      this.isDraggingConnection = true;
      this.dragStartNoteId = noteId;

      // 优先使用事件目标获取连接点的实际位置（最准确）
      const connectionPointEl = event.target.closest('.connection-point');
      if (connectionPointEl) {
        const wallRect = this.$el.getBoundingClientRect();
        const pointRect = connectionPointEl.getBoundingClientRect();

        // 屏幕坐标
        const screenX = pointRect.left + pointRect.width / 2 - wallRect.left;
        const screenY = pointRect.top + pointRect.height / 2 - wallRect.top;

        // 转换为世界坐标
        this.dragStartPoint = this.screenToWorld(screenX, screenY);
      } else {
        // 回退方案：获取便签实际高度并计算位置
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        const noteElement = document.querySelector(`.note[data-note-id="${noteId}"]`);
        let noteHeight = 150; // 默认最小高度

        if (noteElement) {
          // offsetHeight 返回布局尺寸（不包括 CSS transform）
          // 直接使用即可，不需要除以 scale
          noteHeight = noteElement.offsetHeight;
        }

        this.dragStartPoint = {
          x: note.position_x + 125,  // 便签宽度一半（250px / 2）
          y: note.position_y + noteHeight + 8  // 便签实际高度 + 连接点偏移8px
        };
      }

      this.currentMousePos = { ...this.dragStartPoint };

      // 添加全局事件监听
      document.addEventListener('mousemove', this.onConnectionDrag);
      document.addEventListener('mouseup', this.onConnectionDragEnd);
    },

    // 连线拖拽中
    onConnectionDrag(event) {
      if (!this.isDraggingConnection) return;

      const wallRect = this.$el.getBoundingClientRect();

      // 转换鼠标坐标为世界坐标
      const screenX = event.clientX - wallRect.left;
      const screenY = event.clientY - wallRect.top;
      this.currentMousePos = this.screenToWorld(screenX, screenY);
    },

    // 结束连线拖拽
    async onConnectionDragEnd(event) {
      if (!this.isDraggingConnection) return;

      // 检查是否释放到引入点上
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const inputPoint = target?.closest('.input-point');

      if (inputPoint) {
        // 找到对应的便签组件
        const noteElement = inputPoint.closest('.note');
        const targetNoteId = noteElement?.__vueParentComponent?.props?.id;

        if (targetNoteId && targetNoteId !== this.dragStartNoteId) {
          await this.createConnection(this.dragStartNoteId, targetNoteId);
        }
      }

      // 重置状态（Note组件会通过自己的mouseup监听器重置isConnecting状态）
      this.isDraggingConnection = false;
      this.dragStartNoteId = null;
      this.dragStartPoint = null;
      this.currentMousePos = null;

      // 移除事件监听
      document.removeEventListener('mousemove', this.onConnectionDrag);
      document.removeEventListener('mouseup', this.onConnectionDragEnd);
    },

    // 创建连接
    async createConnection(sourceId, targetId) {
      try {
        await axios.post('/api/notes/connections', {
          source_note_id: sourceId,
          target_note_id: targetId
        });

        await this.loadConnections();
      } catch (error) {
        console.error('Failed to create connection:', error);
        if (error.response?.data?.error) {
          alert(error.response.data.error);
        }
      }
    },

    // 选中连接
    selectConnection(connectionId) {
      this.selectedConnectionId = connectionId;
    },

    // 删除选中的连接
    async deleteSelectedConnection() {
      if (!this.selectedConnectionId) return;

      try {
        await axios.delete(`/api/notes/connections/${this.selectedConnectionId}`);
        this.connections = this.connections.filter(
          c => c.id !== this.selectedConnectionId
        );
        this.selectedConnectionId = null;
      } catch (error) {
        console.error('Failed to delete connection:', error);
      }
    },

    // 键盘事件处理（Delete键删除连接）
    onKeyDown(event) {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (this.selectedConnectionId) {
          this.deleteSelectedConnection();
        }
      }
    },

    // 计算连接起点（引出点：便签底部下8px，水平居中）
    getConnectionStartPoint(connection) {
      const note = this.notes.find(n => n.id === connection.source_note_id);
      if (!note) return { x: 0, y: 0 };

      // 尝试获取便签元素的实际高度
      const noteElement = document.querySelector(`.note[data-note-id="${connection.source_note_id}"]`);
      let noteHeight = 150; // 默认最小高度

      if (noteElement) {
        // offsetHeight 返回布局尺寸（不包括 CSS transform）
        // 直接使用即可，不需要除以 scale
        noteHeight = noteElement.offsetHeight;
      }

      return {
        x: note.position_x + 125,  // 便签宽度一半（250px / 2）
        y: note.position_y + noteHeight + 8  // 便签实际高度 + 连接点偏移8px
      };
    },

    // 计算连接终点（引入点：便签顶部上8px，水平居中）
    getConnectionEndPoint(connection) {
      const note = this.notes.find(n => n.id === connection.target_note_id);
      if (!note) return { x: 0, y: 0 };

      return {
        x: note.position_x + 125,  // 便签宽度一半（250px / 2）
        y: note.position_y - 8     // 负偏移8px（在便签顶部上方）
      };
    },

    // 计算箭头顶点
    getArrowheadPoints(connection) {
      const endPoint = this.getConnectionEndPoint(connection);
      const startPoint = this.getConnectionStartPoint(connection);

      const arrowSize = 10;
      const angle = Math.PI / 6; // 30度

      // 计算直线角度
      const deltaX = endPoint.x - startPoint.x;
      const deltaY = endPoint.y - startPoint.y;
      const lineAngle = Math.atan2(deltaY, deltaX);

      // 计算箭头三个顶点
      const p1 = `${endPoint.x},${endPoint.y}`;
      const p2 = `${endPoint.x - arrowSize * Math.cos(lineAngle - angle)},${endPoint.y - arrowSize * Math.sin(lineAngle - angle)}`;
      const p3 = `${endPoint.x - arrowSize * Math.cos(lineAngle + angle)},${endPoint.y - arrowSize * Math.sin(lineAngle + angle)}`;

      return `${p1} ${p2} ${p3}`;
    }
  }
};
</script>

<style scoped>
.note-wall {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #f5f5f5;
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px);
  background-size: 50px 50px;
  overflow: hidden;
  cursor: grab;
}

.note-wall:active {
  cursor: grabbing;
}

/* 白板内容层（应用变换） */
.wall-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  will-change: transform;
}

/* 连接线层样式 */
.connections-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;  /* 允许点击穿透到便签 */
  z-index: 1;  /* 在便签下方 */
}

.connection-line {
  stroke: #2196f3;
  stroke-width: 2;
  pointer-events: stroke;  /* 只在线条上响应点击 */
  cursor: pointer;
  transition: stroke-width 0.2s;
}

.connection-line:hover {
  stroke-width: 3;
  stroke: #1976d2;
}

.connection-line.selected {
  stroke: #ff9800;
  stroke-width: 3;
}

.connection-arrowhead {
  fill: #2196f3;
  pointer-events: stroke;
  cursor: pointer;
  transition: fill 0.2s;
}

.connection-arrowhead:hover {
  fill: #1976d2;
}

.connection-arrowhead.selected {
  fill: #ff9800;
}

.temp-connection-line {
  stroke: #2196f3;
  stroke-width: 2;
  stroke-dasharray: 5, 5;  /* 虚线效果 */
  opacity: 0.6;
}

.add-button {
  position: fixed;
  bottom: 40px;
  right: 40px;
  width: 60px;
  height: 60px;
  background: #4caf50;
  border: none;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  z-index: 1000;
}

.add-button:hover {
  background: #45a049;
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.add-button:active {
  transform: scale(0.95);
}

.plus-icon {
  font-size: 36px;
  color: white;
  font-weight: bold;
  line-height: 1;
}

/* 缩放控制按钮组 */
.zoom-controls {
  position: fixed;
  bottom: 120px;
  right: 40px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  z-index: 1000;
  background: white;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.zoom-btn {
  width: 32px;
  height: 32px;
  background: #4caf50;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 20px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.zoom-btn:hover {
  background: #45a049;
  transform: scale(1.1);
}

.zoom-btn.reset {
  background: #2196f3;
}

.zoom-btn.reset:hover {
  background: #1976d2;
}

.zoom-level {
  font-size: 12px;
  font-weight: bold;
  color: #555;
  margin-top: 4px;
}

/* 固定标题容器 */
.title-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1001;
  pointer-events: none;
}

.wall-title {
  font-size: 2.5rem;
  color: #333;
  margin: 0;
  cursor: pointer;
  position: relative;
  display: inline-block;
  pointer-events: auto;
}

.tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px 15px;
  border-radius: 5px;
  font-size: 1rem;
  min-width: 200px;
  text-align: center;
  z-index: 1002;
  margin-top: 5px;
  opacity: 0.9;
  pointer-events: none;
}

.tooltip::before {
  content: '';
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  border-width: 5px;
  border-style: solid;
  border-color: transparent transparent rgba(0, 0, 0, 0.8) transparent;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1002;
}

.modal-content {
  background-color: white;
  padding: 25px;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #333;
}

.form-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.btn-cancel, .btn-save {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.btn-cancel {
  background-color: #ccc;
  color: #333;
}

.btn-cancel:hover {
  background-color: #bbb;
}

.btn-save {
  background-color: #4caf50;
  color: white;
}

.btn-save:hover {
  background-color: #45a049;
}

.confirm-message {
  color: #666;
  font-size: 1rem;
  line-height: 1.5;
  margin: 15px 0;
}

.btn-delete {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  background-color: #f44336;
  color: white;
}

.btn-delete:hover {
  background-color: #d32f2f;
}

.confirm-modal-overlay {
  z-index: 2001;
}

/* Recycle bin styles */
.recycle-button {
  position: fixed;
  bottom: 40px;
  left: 40px;
  width: 60px;
  height: 60px;
  background: #ff9800;
  border: none;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  z-index: 1000;
}

.recycle-button:hover {
  background: #fb8c00;
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.recycle-button:active {
  transform: scale(0.95);
}

.recycle-icon {
  font-size: 28px;
}

.recycle-count {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #f44336;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  font-size: 14px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
}

.recycle-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.recycle-modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 700px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: modalAppear 0.2s ease-out;
}

@keyframes modalAppear {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.recycle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 8px;
  border-bottom: 1px solid #eee;
}

.recycle-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 32px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  line-height: 1;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #333;
}

.recycle-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.empty-recycle {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.recycle-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recycle-item {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #eee;
  transition: all 0.2s;
}

.recycle-item:hover {
  background: #f5f5f5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.recycle-item-content {
  flex: 1;
  margin-right: 16px;
}

.recycle-item-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin: 0 0 8px 0;
}

.recycle-item-text {
  font-size: 14px;
  color: #666;
  margin: 0 0 8px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recycle-item-time {
  font-size: 12px;
  color: #999;
  margin: 0;
}

.recycle-item-actions {
  display: flex;
  gap: 8px;
}

.btn-restore {
  padding: 8px 16px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.btn-restore:hover {
  background: #45a049;
}

.btn-permanent-delete {
  padding: 8px 16px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.btn-permanent-delete:hover {
  background: #d32f2f;
}

.recycle-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #eee;
}

.btn-clear-all {
  padding: 8px 20px;
  background: #ff9800;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.btn-clear-all:hover {
  background: #fb8c00;
}

.btn-close {
  padding: 8px 20px;
  background: #f5f5f5;
  color: #555;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.btn-close:hover {
  background: #e0e0e0;
}
</style>
