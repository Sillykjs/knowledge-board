<template>
  <div
    class="note-wall"
    @mousedown="onWallMouseDown"
    @mousemove="onWallMouseMove"
    @mouseup="onWallMouseUp"
    @mouseleave="onWallMouseUp"
    @wheel.prevent="onWheel"
    @dblclick="onWallDoubleClick"
  >
    <!-- 固定标题（在白板外部，不受缩放平移影响） -->
    <div class="title-container">
      <h1
        class="wall-title"
        @dblclick="openEditModal"
        @mouseenter="showTooltip = true"
        @mouseleave="showTooltip = false"
      >
        {{ currentTitle }}
        <div
          v-if="showTooltip"
          class="tooltip"
        >
          {{ currentRemark }}
        </div>
      </h1>
    </div>

    <!-- 白板内容变换层 -->
    <div ref="wallContent" class="wall-content" :style="wallTransformStyle" @click.self="handleWallClick">
      <!-- 原点十字准星 -->
      <div class="origin-crosshair">
        <div class="crosshair-line crosshair-horizontal"></div>
        <div class="crosshair-line crosshair-vertical"></div>
        <div class="crosshair-center"></div>
      </div>

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
          :class="['connection-line', {
            selected: selectedConnectionId === connection.id,
            'highlight-flash': highlightedConnectionIds.has(connection.id)
          }]"
          @click.stop="selectConnection(connection.id)"
        />
        <!-- 箭头 -->
        <polygon
          v-for="connection in connections"
          :key="'arrow-' + connection.id"
          :points="getArrowheadPoints(connection)"
          class="connection-arrowhead"
          :class="{
            selected: selectedConnectionId === connection.id,
            'highlight-flash': highlightedConnectionIds.has(connection.id)
          }"
          @click.stop="selectConnection(connection.id)"
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

      <!-- 框选矩形 -->
      <div class="selection-box" :style="selectionBoxStyle"></div>

      <Note
        v-for="note in notes"
        :key="note.id"
        :id="note.id"
        :title="note.title"
        :content="note.content"
        :position_x="note.position_x"
        :position_y="note.position_y"
        :wallId="boardId"
        :isHighlighting="highlightedNoteIds.has(note.id)"
        :isSelected="selectedNoteIds.has(note.id)"
        :contextLevel="contextLevel"
        :currentModelName="currentModelName"
        @update="onNoteUpdate"
        @delete="onNoteDelete"
        @copy="onNoteCopy"
        @trace-parent="onTraceParent"
        @connection-start="onConnectionStart"
        @drag-start="onNoteDragStart"
        @quick-create="onQuickCreate"
      />
    </div>

    <!-- 上文层数控制 -->
    <div class="context-level-control">
      <button class="level-btn" @click="decreaseContextLevel" :disabled="contextLevel <= 1">-</button>
      <div class="level-display">
        <span class="level-label">上文层数</span>
        <input
          type="number"
          v-model.number="contextLevel"
          min="1"
          max="24"
          class="level-input"
          @input="validateContextLevel"
        />
      </div>
      <button class="level-btn" @click="increaseContextLevel" :disabled="contextLevel >= 24">+</button>
    </div>

    <button class="add-button" @click="addNote()">
      <span class="plus-icon">+</span>
    </button>

    <button class="recycle-button" @click="openRecycleBin">
      <span class="recycle-icon">🗑️</span>
      <span v-if="recycleCount > 0" class="recycle-count">{{ recycleCount }}</span>
    </button>

    <!-- 模型快速选择框 -->
    <div class="model-selector">
      <span class="model-label">🤖 模型</span>
      <select
        v-model="selectedModel"
        @change="onModelChange"
        class="model-select"
        title="选择 AI 模型"
      >
        <option value="">请选择模型</option>
        <optgroup v-for="provider in availableModels" :key="provider.provider" :label="provider.provider">
          <option
            v-for="model in provider.models"
            :key="model"
            :value="`${provider.provider}|${model}`"
          >
            {{ model }}
          </option>
        </optgroup>
      </select>
    </div>

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
      <div class="recycle-modal-content" @click.stop @wheel.stop>
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
                <button @click="permanentDelete(note.id)" class="btn-permanent-delete">🗑️ 永久删除</button>
                <button @click="restoreNote(note.id)" class="btn-restore">↩️ 恢复</button>
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
      <div class="modal-content" @click.stop @mousedown.stop @wheel.stop>
        <h3>编辑标题和System Prompt</h3>
        <div class="form-group">
          <label>标题:</label>
          <input v-model="tempTitle" type="text" class="form-input" />
        </div>
        <div class="form-group">
          <label>System Prompt:</label>
          <textarea v-model="tempRemark" class="form-input" rows="16"></textarea>
        </div>
        <div class="modal-buttons">
          <button @click="cancelEdit" class="btn-cancel">取消</button>
          <button @click="saveTitleAndRemark" class="btn-save">保存</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="modal-overlay confirm-modal-overlay">
      <div class="modal-content" @wheel.stop>
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
      <div class="modal-content" @wheel.stop>
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
  props: {
    boardId: {
      type: Number,
      required: true
    },
    boardTitle: {
      type: String,
      default: '默认话题'
    },
    boardSystemPrompt: {
      type: String,
      default: '你是默认助手，回答用户的问题'
    },
    currentModelName: {
      type: String,
      default: 'AI'
    }
  },
  data() {
    return {
      notes: [],
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
      contextLevel: 1,  // 上文层数，默认1层
      connections: [],              // 所有连接关系
      isDraggingConnection: false,  // 是否正在拖拽连线
      dragStartNoteId: null,        // 拖拽起始便签ID
      dragStartPoint: null,         // 拖拽起始点坐标 {x, y}
      highlightTimer: null,         // 高亮清除定时器ID
      currentMousePos: null,        // 当前鼠标坐标
      selectedConnectionId: null,   // 选中的连接ID（用于删除）
      highlightedNoteIds: new Set(), // 高亮的便签ID集合
      highlightedConnectionIds: new Set(), // 高亮的连接线ID集合
      // 便签拖拽状态
      draggingNote: {
        isDragging: false,
        noteId: null,
        offsetX: 0,
        offsetY: 0
      },
      // 框选状态
      boxSelection: {
        isSelecting: false,    // 是否正在框选
        toggleMode: false,     // 是否为切换模式（Shift/Ctrl）
        startX: 0,             // 框选起始X（世界坐标）
        startY: 0,             // 框选起始Y（世界坐标）
        currentX: 0,           // 框选当前X（世界坐标）
        currentY: 0            // 框选当前Y（世界坐标）
      },
      selectedNoteIds: new Set(),  // 选中的便签ID集合
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
      },
      // 模型选择相关
      availableModels: [],    // 可用的模型列表（从 localStorage 读取）
      selectedModel: ''       // 当前选中的模型（格式：provider|model）
    };
  },
  computed: {
    currentTitle() {
      return this.boardTitle;
    },
    currentRemark() {
      return this.boardSystemPrompt;
    },
    layerStyle() {
      // 简单方案：SVG 从 (0,0) 开始，尺寸足够大
      // 这样可以保持坐标系统一致，不需要额外的坐标转换
      const HUGE_SIZE = 50000;  // 50000px 应该足够大

      return {
        left: '0',
        top: '0',
        width: `${HUGE_SIZE}px`,
        height: `${HUGE_SIZE}px`
      };
    },
    // 白板变换样式
    wallTransformStyle() {
      return {
        transform: `translate(${this.viewport.translateX}px, ${this.viewport.translateY}px) scale(${this.viewport.scale})`,
        transformOrigin: '0 0'  // 从左上角开始变换
      };
    },
    // 选择框样式
    selectionBoxStyle() {
      if (!this.boxSelection.isSelecting) {
        return { display: 'none' };
      }

      const box = this.getSelectionBoxRect();

      return {
        left: `${box.x1}px`,
        top: `${box.y1}px`,
        width: `${box.x2 - box.x1}px`,
        height: `${box.y2 - box.y1}px`,
        display: 'block'
      };
    }
  },
  async mounted() {
    await this.loadNotes();
    this.loadRecycleNotes();
    this.loadConnections();
    this.loadModelConfig();

    // 自动跳转到最新便签
    if (this.notes.length > 0) {
      // 按创建时间降序排序，获取最新便签
      const sortedNotes = [...this.notes].sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateB - dateA;
      });

      // 延迟执行，确保 DOM 渲染完成
      this.$nextTick(() => {
        this.jumpToNote(sortedNotes[0]);
      });
    }

    // 添加键盘事件监听
    document.addEventListener('keydown', this.onKeyDown);

    // 添加全局 mouseup 监听器，确保拖拽状态总是能被重置
    document.addEventListener('mouseup', this.onGlobalMouseUp);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('mouseup', this.onGlobalMouseUp);
    // 清除高亮定时器
    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
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
      // 如果有任何模态框打开，不处理白板拖拽
      if (this.isEditingTitle || this.showRecycleBin || this.showDeleteConfirm || this.showClearConfirm) {
        return;
      }

      // 左键（button === 0）：框选或准备拖动便签
      if (event.button === 0) {
        // 检查是否点击在便签上
        const clickedNote = event.target.closest('.note');

        if (clickedNote) {
          // 点击在便签上：检查是否需要拖动选中的便签或取消选中
          const noteId = parseInt(clickedNote.getAttribute('data-note-id'));
          const isSelected = this.selectedNoteIds.has(noteId);

          if (isSelected) {
            // 点击的是已选中的便签
            if (event.shiftKey || event.ctrlKey) {
              // 按住 Shift/Ctrl：取消选中该便签
              event.preventDefault();
              event.stopImmediatePropagation();
              this.selectedNoteIds.delete(noteId);
            } else {
              // 没有按修饰键：准备拖动所有选中的便签
              event.preventDefault();
              event.stopImmediatePropagation(); // 阻止 Note 组件的 mousedown 事件

              const wall = this.$el;
              const wallRect = wall.getBoundingClientRect();
              const noteRect = clickedNote.getBoundingClientRect();

              // 计算点击位置相对于便签的偏移（屏幕坐标）
              const offsetX = event.clientX - noteRect.left;
              const offsetY = event.clientY - noteRect.top;

              this.draggingNote.isDragging = true;
              this.draggingNote.noteId = noteId;
              this.draggingNote.offsetX = offsetX;
              this.draggingNote.offsetY = offsetY;
            }
          } else {
            // 点击的是未选中的便签
            if (event.shiftKey || event.ctrlKey) {
              // 按住 Shift/Ctrl：追加选中该便签（不拖动）
              event.preventDefault();
              event.stopImmediatePropagation();
              this.selectedNoteIds.add(noteId);
            } else {
              // 没有按修饰键：让 Note 组件处理拖动单个便签
              // 不做任何处理，让 Note 组件自己处理
            }
          }
        } else {
          // 点击在空白区域：检查是否可以开始框选
          // 确保没有其他正在进行的操作
          if (this.isDraggingConnection || this.viewport.isDragging) {
            return;
          }

          // 确保不是点击在连接点或控制按钮上
          if (event.target.closest('.connection-point') ||
              event.target.closest('.context-level-control') ||
              event.target.closest('.model-selector') ||
              event.target.closest('.model-select') ||
              event.target.closest('.add-button') ||
              event.target.closest('.recycle-button') ||
              event.target.closest('.zoom-controls') ||
              event.target.closest('.title-container')) {
            return;
          }

          event.preventDefault();

          const wall = this.$el;
          const wallRect = wall.getBoundingClientRect();

          // 转换为世界坐标
          const screenX = event.clientX - wallRect.left;
          const screenY = event.clientY - wallRect.top;
          const worldPos = this.screenToWorld(screenX, screenY);

          // 开始框选
          this.boxSelection.isSelecting = true;
          this.boxSelection.toggleMode = event.shiftKey || event.ctrlKey;
          this.boxSelection.startX = worldPos.x;
          this.boxSelection.startY = worldPos.y;
          this.boxSelection.currentX = worldPos.x;
          this.boxSelection.currentY = worldPos.y;

          // 如果不是切换模式且没有按住 Shift/Ctrl，清空之前的选择
          if (!this.boxSelection.toggleMode) {
            this.selectedNoteIds.clear();
          }
        }
      }
      // 中键（button === 1）：拖动白板（允许在便签上拖动）
      else if (event.button === 1) {
        // 确保不是点击在连接点上
        if (event.target.closest('.connection-point') ||
            event.target.closest('.context-level-control')) {
          return;
        }

        // 中键拖动时 preventDefault() 防止滚动
        event.preventDefault();

        this.viewport.isDragging = true;
        this.viewport.lastMouseX = event.clientX;
        this.viewport.lastMouseY = event.clientY;
      }
      // 右键（button === 2）：拖动白板（不允许在便签上拖动）
      else if (event.button === 2) {
        // 确保不是点击在便签或连接点上
        if (event.target.closest('.note') ||
            event.target.closest('.connection-point') ||
            event.target.closest('.context-level-control')) {
          return;
        }

        // 右键拖动时 preventDefault() 防止默认菜单
        event.preventDefault();

        this.viewport.isDragging = true;
        this.viewport.lastMouseX = event.clientX;
        this.viewport.lastMouseY = event.clientY;
      }
    },
    // 白板鼠标移动事件
    onWallMouseMove(event) {
      // 处理框选
      if (this.boxSelection.isSelecting) {
        const wall = this.$el;
        const wallRect = wall.getBoundingClientRect();

        // 转换为世界坐标
        const screenX = event.clientX - wallRect.left;
        const screenY = event.clientY - wallRect.top;
        const worldPos = this.screenToWorld(screenX, screenY);

        // 更新框选当前点
        this.boxSelection.currentX = worldPos.x;
        this.boxSelection.currentY = worldPos.y;

        // 实时计算框选范围内的便签
        this.updateSelectedNotesInBox();
        return;
      }

      // 处理便签拖拽
      if (this.draggingNote.isDragging) {
        const wall = this.$el;
        const wallRect = wall.getBoundingClientRect();

        // 计算鼠标相对于白板的屏幕坐标
        const screenX = event.clientX - wallRect.left - this.draggingNote.offsetX;
        const screenY = event.clientY - wallRect.top - this.draggingNote.offsetY;

        // 转换为世界坐标
        const worldPos = this.screenToWorld(screenX, screenY);

        // 检查是否拖动选中的便签
        const isDraggingSelected = this.selectedNoteIds.has(this.draggingNote.noteId);

        if (isDraggingSelected && this.selectedNoteIds.size > 1) {
          // 拖动多个选中的便签
          const draggedNote = this.notes.find(n => n.id === this.draggingNote.noteId);
          if (!draggedNote) return;

          // 计算移动的偏移量
          const deltaX = worldPos.x - draggedNote.position_x;
          const deltaY = worldPos.y - draggedNote.position_y;

          // 更新所有选中的便签位置
          this.selectedNoteIds.forEach(noteId => {
            const note = this.notes.find(n => n.id === noteId);
            if (note) {
              note.position_x += deltaX;
              note.position_y += deltaY;
            }
          });
        } else {
          // 拖动单个便签
          const note = this.notes.find(n => n.id === this.draggingNote.noteId);
          if (note) {
            note.position_x = worldPos.x;
            note.position_y = worldPos.y;
          }
        }
        return;
      }

      // 处理白板平移
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
      // 结束框选
      if (this.boxSelection.isSelecting) {
        this.boxSelection.isSelecting = false;
        this.boxSelection.toggleMode = false;
        // 记录框选结束时间，防止 click 事件立即清空选择
        this._lastBoxSelectionTime = Date.now();
        return;
      }

      // 结束便签拖拽并保存到后端
      if (this.draggingNote.isDragging) {
        const isDraggingSelected = this.selectedNoteIds.has(this.draggingNote.noteId);

        if (isDraggingSelected && this.selectedNoteIds.size > 1) {
          // 保存所有选中的便签位置
          this.selectedNoteIds.forEach(noteId => {
            const note = this.notes.find(n => n.id === noteId);
            if (note) {
              this.saveNotePosition(note.id, note.position_x, note.position_y);
            }
          });
        } else {
          // 保存单个便签位置
          const note = this.notes.find(n => n.id === this.draggingNote.noteId);
          if (note) {
            this.saveNotePosition(note.id, note.position_x, note.position_y);
          }
        }

        this.draggingNote.isDragging = false;
        this.draggingNote.noteId = null;
        return;
      }

      // 结束白板平移
      if (this.viewport.isDragging) {
        this.viewport.isDragging = false;
      }
    },
    // 全局 mouseup 事件（确保状态总是能被重置，即使鼠标移出白板区域）
    onGlobalMouseUp(event) {
      // 重置框选状态
      if (this.boxSelection.isSelecting) {
        this.boxSelection.isSelecting = false;
        this.boxSelection.toggleMode = false;
        // 记录框选结束时间，防止 click 事件立即清空选择
        this._lastBoxSelectionTime = Date.now();
      }

      // 重置便签拖拽状态
      if (this.draggingNote.isDragging) {
        const isDraggingSelected = this.selectedNoteIds.has(this.draggingNote.noteId);

        if (isDraggingSelected && this.selectedNoteIds.size > 1) {
          // 保存所有选中的便签位置
          this.selectedNoteIds.forEach(noteId => {
            const note = this.notes.find(n => n.id === noteId);
            if (note) {
              this.saveNotePosition(note.id, note.position_x, note.position_y);
            }
          });
        } else {
          // 保存单个便签位置
          const note = this.notes.find(n => n.id === this.draggingNote.noteId);
          if (note) {
            this.saveNotePosition(note.id, note.position_x, note.position_y);
          }
        }

        this.draggingNote.isDragging = false;
        this.draggingNote.noteId = null;
      }

      // 重置白板平移状态
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
    async loadNotes() {
      try {
        const response = await axios.get('/api/notes', {
          params: { wall_id: this.boardId }
        });
        this.notes = response.data.notes;
        // 通知父组件便签列表已更新
        this.$emit('notes-loaded', this.notes);
      } catch (error) {
        console.error('Failed to load notes:', error);
      }
    },
    async addNote(customPosition = null) {
      const newPosition = customPosition || this.calculateNewPosition();

      try {
        const response = await axios.post('/api/notes', {
          title: '新便签',
          content: '点击编辑添加内容',
          position_x: newPosition.x,
          position_y: newPosition.y,
          wall_id: this.boardId
        });

        this.notes.push(response.data.note);

        // 通知父组件便签列表已更新
        this.$emit('notes-loaded', this.notes);
        // 通知父组件更新白板列表（便签数量变化）
        this.$emit('note-count-changed');
      } catch (error) {
        console.error('Failed to create note:', error);
      }
    },
    calculateNewPosition() {
      // 获取白板容器的位置
      const wallRect = this.$el.getBoundingClientRect();

      // 浏览器视口中心（相对于浏览器视口）
      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;

      // 转换为相对于白板容器的坐标（与 onWallMouseMove 和 onWallDoubleClick 的逻辑一致）
      const screenCenterX = viewportCenterX - wallRect.left;
      const screenCenterY = viewportCenterY - wallRect.top;

      // 转换为白板世界坐标
      const worldPos = this.screenToWorld(screenCenterX, screenCenterY);

      // 便签尺寸（宽度250px，默认高度150px）
      const noteWidth = 250;
      const noteHeight = 150;

      // 计算便签左上角位置，使便签中心对准屏幕中心
      return {
        x: worldPos.x - noteWidth / 2,
        y: worldPos.y - noteHeight / 2
      };
    },
    onNoteUpdate(updatedNote) {
      const index = this.notes.findIndex(n => n.id === updatedNote.id);
      if (index !== -1) {
        // 使用 Vue 3 的响应式方式更新数组
        this.notes.splice(index, 1, { ...updatedNote });
        // 强制连接线重新计算（通过重新触发响应式更新）
        this.$forceUpdate();
        // 通知父组件便签列表已更新
        this.$emit('notes-loaded', this.notes);
      }
    },
    async onNoteDelete(noteId) {
      // 先加载连接（后端会自动删除相关连接），避免渲染时找不到便签导致连接线闪烁到原点
      await this.loadConnections();
      // 再从 notes 数组中移除便签
      this.notes = this.notes.filter(n => n.id !== noteId);
      this.loadRecycleNotes();

      // 通知父组件便签列表已更新
      this.$emit('notes-loaded', this.notes);
      // 通知父组件更新白板列表（便签数量变化）
      this.$emit('note-count-changed');
    },
    // 复制便签
    async onNoteCopy(sourceNote) {
      try {
        // 计算新便签位置：在原便签右下方偏移
        const offsetX = 30;  // 水平偏移
        const offsetY = 30;  // 垂直偏移

        const response = await axios.post('/api/notes', {
          title: sourceNote.title,
          content: sourceNote.content,
          position_x: sourceNote.position_x + offsetX,
          position_y: sourceNote.position_y + offsetY,
          wall_id: this.boardId
        });

        this.notes.push(response.data.note);

        // 通知父组件便签列表已更新
        this.$emit('notes-loaded', this.notes);
        // 通知父组件更新白板列表（便签数量变化）
        this.$emit('note-count-changed');
      } catch (error) {
        console.error('Failed to copy note:', error);
        alert('复制便签失败: ' + (error.response?.data?.error || error.message));
      }
    },
    // 上文追溯
    onTraceParent(noteId) {
      // 清除之前的定时器（如果存在）
      if (this.highlightTimer) {
        clearTimeout(this.highlightTimer);
        this.highlightTimer = null;
      }

      // 使用广度优先搜索（BFS）查找多层父节点
      const highlightedNoteIds = new Set();
      const highlightedConnectionIds = new Set();

      // 队列存储：{ noteId, level }
      const queue = [{ noteId, level: 0 }];
      const visited = new Set();  // 避免循环引用导致无限循环

      while (queue.length > 0) {
        const { noteId: currentNoteId, level } = queue.shift();

        // 如果达到指定的层数，停止查找
        if (level >= this.contextLevel) {
          continue;
        }

        // 如果已经访问过这个节点，跳过（避免循环）
        if (visited.has(currentNoteId)) {
          continue;
        }
        visited.add(currentNoteId);

        // 找到所有以当前节点为目标节点的连接（即父节点）
        const parentConnections = this.connections.filter(
          conn => conn.target_note_id === currentNoteId
        );

        // 遍历所有父节点
        parentConnections.forEach(conn => {
          const parentId = conn.source_note_id;

          // 添加父节点 ID 和连接 ID
          highlightedNoteIds.add(parentId);
          highlightedConnectionIds.add(conn.id);

          // 将父节点加入队列，继续查找其父节点（层数+1）
          queue.push({ noteId: parentId, level: level + 1 });
        });
      }

      // 添加到高亮集合
      this.highlightedNoteIds = highlightedNoteIds;
      this.highlightedConnectionIds = highlightedConnectionIds;

      // 2秒后清除高亮（动画时长是 2 秒）
      this.highlightTimer = setTimeout(() => {
        this.highlightedNoteIds.clear();
        this.highlightedConnectionIds.clear();
        this.highlightTimer = null;
      }, 2000);
    },
    // 便签拖拽开始
    onNoteDragStart(payload) {
      this.draggingNote.isDragging = true;
      this.draggingNote.noteId = payload.noteId;
      this.draggingNote.offsetX = payload.offsetX;
      this.draggingNote.offsetY = payload.offsetY;
    },
    // 保存便签位置到后端
    async saveNotePosition(noteId, x, y) {
      try {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        await axios.put(`/api/notes/${noteId}`, {
          title: note.title,
          content: note.content,
          position_x: x,
          position_y: y
        });
      } catch (error) {
        console.error('Failed to save note position:', error);
      }
    },
    openEditModal() {
      // Initialize temp values with current values when opening the modal
      this.tempTitle = this.currentTitle;
      this.tempRemark = this.currentRemark;
      this.isEditingTitle = true;
    },
    async saveTitleAndRemark() {
      try {
        // 调用后端 API 保存配置
        await axios.put(`/api/notes/boards/${this.boardId}`, {
          title: this.tempTitle,
          system_prompt: this.tempRemark
        });

        // 通知父组件更新白板列表
        this.$emit('board-updated', {
          id: this.boardId,
          title: this.tempTitle,
          system_prompt: this.tempRemark
        });

        this.isEditingTitle = false;
      } catch (error) {
        console.error('Failed to save wall config:', error);
        alert('保存失败，请重试');
      }
    },
    cancelEdit() {
      // Reset temp values to current saved values
      this.tempTitle = this.currentTitle;
      this.tempRemark = this.currentRemark;
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
        const response = await axios.get('/api/notes/recycle-bin', {
          params: { wall_id: this.boardId }
        });
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

        // 通知父组件更新白板列表（便签数量变化）
        this.$emit('note-count-changed');
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
        await axios.delete('/api/notes/recycle-bin', {
          params: { wall_id: this.boardId }
        });
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
        const response = await axios.get('/api/notes/connections', {
          params: { wall_id: this.boardId }
        });
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

      // 检查是否释放到便签上（任意位置）
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const noteElement = target?.closest('.note');

      if (noteElement) {
        // 获取便签 ID
        const targetNoteId = parseInt(noteElement.getAttribute('data-note-id'));

        if (targetNoteId && targetNoteId !== this.dragStartNoteId) {
          await this.createConnection(this.dragStartNoteId, targetNoteId);
        }
      } else {
        // 没有释放到便签上，在空白处创建新便签并连接
        await this.createNoteAndConnect(this.dragStartNoteId, this.currentMousePos);
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

    // 创建新便签并连接
    async createNoteAndConnect(sourceId, position) {
      try {
        // 计算新便签的位置（使连接点对准鼠标位置）
        // 新便签的引入点在顶部中心，需要向上偏移
        const newNoteX = position.x - 125; // 便签宽度一半（250px / 2）
        const newNoteY = position.y - 12;  // 连接点偏移12px（与样式中的 -12px 对应）

        // 创建新便签
        const response = await axios.post('/api/notes', {
          title: '新便签',
          content: '',
          position_x: newNoteX,
          position_y: newNoteY,
          wall_id: this.boardId
        });

        const newNoteId = response.data.note.id;

        // 创建连接
        await this.createConnection(sourceId, newNoteId);

        // 重新加载便签列表
        await this.loadNotes();
      } catch (error) {
        console.error('Failed to create note and connect:', error);
        alert('创建便签失败: ' + (error.response?.data?.error || error.message));
      }
    },

    // 双击引出点快速创建新便签并连接（在正下方）
    async onQuickCreate(payload) {
      const { noteId, event } = payload;
      const sourceNote = this.notes.find(n => n.id === noteId);
      if (!sourceNote) return;

      try {
        // 获取源便签的实际高度
        const noteElement = document.querySelector(`.note[data-note-id="${noteId}"]`);
        let noteHeight = 180; // 默认高度

        if (noteElement) {
          noteHeight = noteElement.offsetHeight / this.viewport.scale;
        }

        // 计算新便签位置：在源便签正下方
        // 源便签引出点：position_y + noteHeight + 12
        // 新便签引入点：position_y - 12
        // 两个连接点之间的距离设置为 100px
        const verticalGap = 60;
        const newNoteX = sourceNote.position_x; // 水平对齐
        const newNoteY = sourceNote.position_y + noteHeight + verticalGap; // 在下方

        // 创建新便签
        const response = await axios.post('/api/notes', {
          title: '新便签',
          content: '',
          position_x: newNoteX,
          position_y: newNoteY,
          wall_id: this.boardId
        });

        const newNote = response.data.note;
        const newNoteId = newNote.id;

        // 立即将新便签添加到本地数组（避免连接线闪烁到原点）
        this.notes.push(newNote);

        // 创建连接
        await this.createConnection(noteId, newNoteId);

        // 重新加载连接列表
        await this.loadConnections();

        // 通知父组件便签列表已更新
        this.$emit('notes-loaded', this.notes);
        // 通知父组件更新白板列表（便签数量变化）
        this.$emit('note-count-changed');
      } catch (error) {
        console.error('Failed to quick create note:', error);
        alert('创建便签失败: ' + (error.response?.data?.error || error.message));
      }
    },

    // 选中连接
    selectConnection(connectionId) {
      this.selectedConnectionId = connectionId;
    },

    // 点击白板空白区域处理（取消选择连接线）
    handleWallClick(event) {
      // 如果点击在模型选择器上，不处理
      if (event.target.closest('.model-selector') ||
          event.target.closest('.model-select')) {
        return;
      }

      // 只在没有进行平移操作时取消选择
      // 注意：由于 mousedown 中的 preventDefault，平移操作不会触发 click 事件
      // 所以这里可以安全地取消选择

      // 如果刚刚结束框选（在短时间内），不清空选择
      const now = Date.now();
      if (this._lastBoxSelectionTime && (now - this._lastBoxSelectionTime < 100)) {
        this._lastBoxSelectionTime = null;
        return;
      }

      this.selectedConnectionId = null;
      // 清空便签选择
      this.selectedNoteIds.clear();
    },
    // 双击白板空白区域处理（在鼠标位置创建新便签）
    onWallDoubleClick(event) {
      // 确保不是双击在便签、连接线、连接点、标题或按钮上
      if (event.target.closest('.note') ||
          event.target.closest('.connection-line') ||
          event.target.closest('.connection-point') ||
          event.target.closest('.title-container') ||
          event.target.closest('.add-button') ||
          event.target.closest('.recycle-button') ||
          event.target.closest('.zoom-controls') ||
          event.target.closest('.context-level-control') ||
          event.target.closest('.model-selector') ||
          event.target.closest('.model-select') ||
          event.target.closest('.modal-overlay') ||
          event.target.closest('.recycle-modal')) {
        return;
      }

      // 获取鼠标相对于白板的屏幕坐标
      const wallRect = this.$el.getBoundingClientRect();
      const screenX = event.clientX - wallRect.left;
      const screenY = event.clientY - wallRect.top;

      // 转换为世界坐标
      const worldPos = this.screenToWorld(screenX, screenY);

      // 计算便签左上角位置（使便签中心对准鼠标位置）
      const noteWidth = 250;
      const noteHeight = 150;
      const customPosition = {
        x: worldPos.x - noteWidth / 2,
        y: worldPos.y - noteHeight / 2
      };

      // 在计算出的位置创建便签
      this.addNote(customPosition);
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

    // 键盘事件处理（Delete键删除连接或便签，Escape键清空选择）
    onKeyDown(event) {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // 优先删除选中的便签
        if (this.selectedNoteIds.size > 0) {
          this.deleteSelectedNotes();
        }
        // 否则删除选中的连接线
        else if (this.selectedConnectionId) {
          this.deleteSelectedConnection();
        }
      }
      // Escape键清空选择
      else if (event.key === 'Escape') {
        this.selectedNoteIds.clear();
        this.selectedConnectionId = null;
      }
    },

    // 删除选中的便签
    async deleteSelectedNotes() {
      if (this.selectedNoteIds.size === 0) return;

      // 批量删除便签
      for (const noteId of this.selectedNoteIds) {
        try {
          await axios.delete(`/api/notes/${noteId}`);
        } catch (error) {
          console.error('Failed to delete note:', error);
        }
      }

      // 清空选择
      this.selectedNoteIds.clear();

      // 重新加载便签和连接
      await this.loadNotes();
      await this.loadConnections();
      await this.loadRecycleNotes();

      // 通知父组件更新白板列表（便签数量变化）
      this.$emit('note-count-changed');
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
    },

    // ========== 上文层数控制方法 ==========

    // 增加上文层数
    increaseContextLevel() {
      if (this.contextLevel < 24) {
        this.contextLevel++;
      }
    },
    // 减少上文层数
    decreaseContextLevel() {
      if (this.contextLevel > 1) {
        this.contextLevel--;
      }
    },
    // 验证输入的有效性
    validateContextLevel() {
      // 确保在有效范围内
      if (this.contextLevel < 1) {
        this.contextLevel = 1;
      } else if (this.contextLevel > 24) {
        this.contextLevel = 24;
      }
      // 确保是整数
      this.contextLevel = Math.round(this.contextLevel);
    },

    // ========== 框选相关方法 ==========

    // 更新选择框内的便签
    updateSelectedNotesInBox() {
      const box = this.getSelectionBoxRect();

      this.notes.forEach(note => {
        if (this.isNoteInSelectionBox(note, box)) {
          if (this.boxSelection.toggleMode) {
            // 切换模式：已选中的取消，未选中的选中
            if (this.selectedNoteIds.has(note.id)) {
              this.selectedNoteIds.delete(note.id);
            } else {
              this.selectedNoteIds.add(note.id);
            }
          } else {
            // 普通模式：只添加选中
            this.selectedNoteIds.add(note.id);
          }
        }
      });
    },

    // 获取选择框的矩形（规范化为左上角和右下角）
    getSelectionBoxRect() {
      const x1 = Math.min(this.boxSelection.startX, this.boxSelection.currentX);
      const y1 = Math.min(this.boxSelection.startY, this.boxSelection.currentY);
      const x2 = Math.max(this.boxSelection.startX, this.boxSelection.currentX);
      const y2 = Math.max(this.boxSelection.startY, this.boxSelection.currentY);

      return { x1, y1, x2, y2 };
    },

    // 判断便签是否在选择框内
    isNoteInSelectionBox(note, box) {
      // 便签尺寸（宽度250px，高度需要动态获取）
      const noteWidth = 250;
      let noteHeight = 150;

      // 尝试获取便签的实际高度
      const noteElement = document.querySelector(`.note[data-note-id="${note.id}"]`);
      if (noteElement) {
        noteHeight = noteElement.offsetHeight / this.viewport.scale;
      }

      // 便签的四个角
      const noteLeft = note.position_x;
      const noteRight = note.position_x + noteWidth;
      const noteTop = note.position_y;
      const noteBottom = note.position_y + noteHeight;

      // 检查便签是否与选择框相交
      return !(noteRight < box.x1 ||
               noteLeft > box.x2 ||
               noteBottom < box.y1 ||
               noteTop > box.y2);
    },

    // 清空选择
    clearSelection() {
      this.selectedNoteIds.clear();
    },

    // ========== 模型选择相关方法 ==========

    // 加载模型配置
    loadModelConfig() {
      try {
        const modelsJson = localStorage.getItem('modelsJson');
        if (modelsJson) {
          this.availableModels = JSON.parse(modelsJson);
        } else {
          // 如果没有配置，使用默认空列表
          this.availableModels = [];
        }

        // 加载当前选中的模型
        const lastUsedModel = localStorage.getItem('lastUsedModel');
        if (lastUsedModel) {
          this.selectedModel = lastUsedModel;
        }
      } catch (error) {
        console.error('Failed to load model config:', error);
        this.availableModels = [];
      }
    },

    // 模型改变事件
    onModelChange() {
      if (this.selectedModel) {
        // 保存到 localStorage
        localStorage.setItem('lastUsedModel', this.selectedModel);

        // 解析厂商和模型名称
        const parts = this.selectedModel.split('|');
        if (parts.length === 2) {
          const [provider, modelName] = parts;

          // 触发事件通知父组件（App.vue）
          this.$emit('model-changed', {
            provider: provider,
            model: modelName,
            fullKey: this.selectedModel
          });

          console.log('模型已切换到:', provider, '-', modelName);
        }
      }
    },

    // ========== 供 App.vue 调用的方法 ==========

    // 跳转到指定便签
    jumpToNote(note) {
      // 添加动画 class
      if (this.$refs.wallContent) {
        this.$refs.wallContent.classList.add('animating');
      }

      // 获取便签的实际尺寸
      const noteElement = document.querySelector(`.note[data-note-id="${note.id}"]`);
      let noteHeight = 150; // 默认高度
      let noteWidth = 250;

      if (noteElement) {
        noteHeight = noteElement.offsetHeight / this.viewport.scale;
        noteWidth = noteElement.offsetWidth / this.viewport.scale;
      }

      // 计算便签中心的世界坐标
      const noteCenterX = note.position_x + noteWidth / 2;
      const noteCenterY = note.position_y + noteHeight / 2;

      // 计算目标平移量，使便签中心位于屏幕中心
      // 屏幕中心坐标
      const wallRect = this.$el.getBoundingClientRect();
      const screenCenterX = wallRect.width / 2;
      const screenCenterY = wallRect.height / 2;

      // 反向计算平移量：screenCenter = worldPos * scale + translate
      // => translate = screenCenter - worldPos * scale
      this.viewport.translateX = screenCenterX - noteCenterX * this.viewport.scale;
      this.viewport.translateY = screenCenterY - noteCenterY * this.viewport.scale;

      // 动画结束后移除 class（1000ms 与 CSS transition 时间一致）
      setTimeout(() => {
        if (this.$refs.wallContent) {
          this.$refs.wallContent.classList.remove('animating');
        }
      }, 1000);

      // 高亮该便签2秒
      this.highlightedNoteIds.clear();
      this.highlightedNoteIds.add(note.id);

      if (this.highlightTimer) {
        clearTimeout(this.highlightTimer);
      }

      this.highlightTimer = setTimeout(() => {
        this.highlightedNoteIds.clear();
        this.highlightTimer = null;
      }, 2000);
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
  /* 启用 GPU 加速和优化渲染质量 */
  will-change: transform;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* 确保缩放时文字清晰 */
  image-rendering: -webkit-optimize-contrast;
  /* 强制使用 sub-pixel 渲染 */
  text-rendering: optimizeLegibility;
  /* 关键：添加平滑过渡，强制浏览器使用高质量渲染路径重新光栅化 */
  transition: transform 0.15s ease-out;
}

/* 平滑过渡动画（跳转时使用更长的过渡时间） */
.wall-content.animating {
  transition: transform 1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* 原点十字准星样式 */
.origin-crosshair {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 0;
}

.crosshair-line {
  position: absolute;
  background: #2196f3;
  opacity: 0.5;
}

.crosshair-horizontal {
  top: 0px;
  left: -100px;
  width: 200px;
  height: 2px;
}

.crosshair-vertical {
  top: -100px;
  left: 0px;
  width: 2px;
  height: 200px;
}

.crosshair-center {
  position: absolute;
  top: -5px;
  left: -5px;
  width: 12px;
  height: 12px;
  background: #2196f3;
  border-radius: 50%;
  opacity: 0.7;
}

/* 框选矩形样式 */
.selection-box {
  position: absolute;
  border: 2px dashed #2196f3;
  background-color: rgba(33, 150, 243, 0.1);
  pointer-events: none;
  z-index: 5;
}

/* 连接线层样式 */
.connections-layer {
  position: absolute;
  /* 位置和尺寸由 layerStyle 计算属性动态设置 */
  pointer-events: none;  /* 允许点击穿透到便签 */
  z-index: 1;  /* 在便签下方 */
  overflow: visible;  /* 确保内容不被裁剪 */
}

.connection-line {
  stroke: #2196f3;
  stroke-width: 3;
  pointer-events: stroke;  /* 只在线条上响应点击 */
  cursor: pointer;
  transition: stroke-width 0.2s;
}

.connection-line:hover {
  stroke-width: 4;
  stroke: #1976d2;
}

.connection-line.selected {
  stroke: #ff9800;
  stroke-width: 4;
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
  stroke-width: 3;
  stroke-dasharray: 5, 5;  /* 虚线效果 */
  opacity: 0.6;
}

/* 连接线高亮闪烁动画 */
.connection-line.highlight-flash,
.connection-arrowhead.highlight-flash {
  animation: flashConnectionGreen 2s ease-in-out;
}

@keyframes flashConnectionGreen {
  0%, 100% {
    stroke: #2196f3;
    fill: #2196f3;
  }
  25%, 75% {
    stroke: #4caf50;
    fill: #4caf50;
  }
  50% {
    stroke: #2196f3;
    fill: #2196f3;
  }
}

/* 上文层数控制 */
.context-level-control {
  position: absolute;
  bottom: 20px;
  right: 100px; /* 在添加按钮左边，添加按钮宽度60px + 间距20px */
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

/* 模型选择器 */
.model-selector {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  background: white;
  border-radius: 8px;
  padding: 8px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  pointer-events: auto;
}

.model-label {
  font-size: 14px;
  color: #666;
  white-space: nowrap;
}

.model-select {
  min-width: 200px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  color: #333;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.model-select:hover {
  border-color: #9c27b0;
}

.model-select:focus {
  outline: none;
  border-color: #9c27b0;
  box-shadow: 0 0 0 2px rgba(156, 39, 176, 0.2);
}

.model-select option {
  padding: 8px;
  font-size: 13px;
}

.level-btn {
  width: 32px;
  height: 32px;
  background: #4caf50;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.level-btn:hover:not(:disabled) {
  background: #45a049;
  transform: scale(1.1);
}

.level-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.level-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.5;
}

.level-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
}

.level-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 2px;
}

.level-input {
  width: 50px;
  height: 28px;
  text-align: center;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  color: #333;
  padding: 0;
  -moz-appearance: textfield; /* Firefox 去除数字输入框的箭头 */
}

.level-input::-webkit-outer-spin-button,
.level-input::-webkit-inner-spin-button {
  -webkit-appearance: none; /* Chrome 去除数字输入框的箭头 */
  margin: 0;
}

.level-input:focus {
  outline: none;
  border-color: #4caf50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
}

.add-button {
  position: absolute;
  bottom: 20px;
  right: 20px;
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
  position: absolute;
  bottom: 100px;
  right: 25px;
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
  position: absolute;
  bottom: 20px;
  left: 20px; /* 调整位置，避免与侧边栏重叠（侧边栏宽度250px + 20px间距） */
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
