<template>
  <div
    class="note-wall"
    @dragover.prevent
    @drop="onDrop"
  >
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
    />

    <button class="add-button" @click="addNote">
      <span class="plus-icon">+</span>
    </button>

    <button class="recycle-button" @click="openRecycleBin">
      <span class="recycle-icon">🗑️</span>
      <span v-if="recycleCount > 0" class="recycle-count">{{ recycleCount }}</span>
    </button>

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
      showClearConfirm: false
    };
  },
  mounted() {
    this.loadNotes();
    this.loadRecycleNotes();
    this.loadWallConfig();
  },
  methods: {
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
        this.notes[index] = updatedNote;
      }
    },
    onNoteDelete(noteId) {
      this.notes = this.notes.filter(n => n.id !== noteId);
      this.loadRecycleNotes();
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
  overflow: auto;
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

.title-container {
  text-align: center;
  padding: 20px 0;
  margin-bottom: 20px;
  position: relative;
}

.wall-title {
  font-size: 2.5rem;
  color: #333;
  margin: 0;
  cursor: pointer;
  position: relative;
  display: inline-block;
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
  z-index: 1001;
  margin-top: 5px;
  opacity: 0.9;
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
