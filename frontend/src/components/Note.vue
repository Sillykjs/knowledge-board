<template>
  <div
    class="note"
    :style="{ left: position_x + 'px', top: position_y + 'px' }"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @contextmenu.prevent="onContextMenu"
    @mousedown="onMouseDown"
  >
    <div class="note-content">
      <h3 class="note-title">{{ title }}</h3>
      <p class="note-text">{{ content }}</p>
    </div>
    <!-- 右键菜单 -->
    <div
      v-if="showContextMenu"
      class="context-menu"
      :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
    >
      <div class="context-menu-item" @click="startEdit">
        <span class="menu-icon">✏️</span>
        <span>编辑</span>
      </div>
      <div class="context-menu-item danger" @click="deleteNote">
        <span class="menu-icon">🗑️</span>
        <span>删除</span>
      </div>
    </div>

    <!-- 编辑模态框 -->
    <div v-if="showEditModal" class="edit-modal">
      <div class="edit-modal-content">
        <div class="edit-header">
          <h3>编辑笔记</h3>
          <button class="close-btn" @click="cancelEdit">×</button>
        </div>
        <div class="edit-body">
          <input
            v-model="editTitle"
            class="edit-title"
            placeholder="标题"
            @keyup.enter="handleEnterKey"
          />
          <textarea
            v-model="editContent"
            class="edit-content"
            placeholder="内容"
          ></textarea>
        </div>
        <div class="edit-footer">
          <button @click="cancelEdit" class="btn-cancel">取消</button>
          <button @click="saveEdit" class="btn-save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'Note',
  props: {
    id: Number,
    title: String,
    content: String,
    position_x: Number,
    position_y: Number
  },
  data() {
    return {
      showEditModal: false,
      editTitle: this.title,
      editContent: this.content,
      dragOffsetX: 0,
      dragOffsetY: 0,
      showContextMenu: false,
      contextMenuX: 0,
      contextMenuY: 0,
      isDraggingEnabled: true
    };
  },
  methods: {
    onMouseDown() {
      // 如果编辑模态框打开，则禁用拖拽
      if (this.showEditModal) {
        this.isDraggingEnabled = false;
      } else {
        this.isDraggingEnabled = true;
      }
    },

    onDragStart(e) {
      // 如果编辑模态框打开或拖拽被禁用，则阻止拖拽
      if (this.showEditModal || !this.isDraggingEnabled) {
        e.preventDefault();
        return;
      }

      this.showContextMenu = false;

      const rect = e.target.getBoundingClientRect();
      this.dragOffsetX = e.clientX - rect.left;
      this.dragOffsetY = e.clientY - rect.top;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('noteId', this.id);
    },

    onDragEnd(e) {
      const wall = document.querySelector('.note-wall');
      const wallRect = wall.getBoundingClientRect();
      const newX = e.clientX - wallRect.left - this.dragOffsetX;
      const newY = e.clientY - wallRect.top - this.dragOffsetY;

      this.updatePosition(newX, newY);
    },
    startEdit() {
      this.showContextMenu = false;
      this.showEditModal = true;
      this.editTitle = this.title;
      this.editContent = this.content;
    },
    async saveEdit() {
      if (!this.showEditModal) return;

      try {
        await axios.put(`/api/notes/${this.id}`, {
          title: this.editTitle,
          content: this.editContent,
          position_x: this.position_x,
          position_y: this.position_y
        });

        this.$emit('update', {
          id: this.id,
          title: this.editTitle,
          content: this.editContent,
          position_x: this.position_x,
          position_y: this.position_y
        });

        this.showEditModal = false;
      } catch (error) {
        console.error('Failed to update note:', error);
      }
    },

    cancelEdit() {
      this.showEditModal = false;
    },

    handleEnterKey(event) {
      // 在标题输入框中按 Enter 键时，焦点移到内容输入框
      if (event.target.classList.contains('edit-title')) {
        event.preventDefault();
        this.$nextTick(() => {
          document.querySelector('.edit-content').focus();
        });
      }
    },
    async deleteNote() {
      this.showContextMenu = false;

      try {
        await axios.delete(`/api/notes/${this.id}`);
        this.$emit('delete', this.id);
      } catch (error) {
        console.error('Failed to delete note:', error);
      }
    },
    async updatePosition(x, y) {
      try {
        const newX = Math.max(0, x);
        const newY = Math.max(0, y);

        await axios.put(`/api/notes/${this.id}`, {
          title: this.title,
          content: this.content,
          position_x: newX,
          position_y: newY
        });

        this.$emit('update', {
          id: this.id,
          title: this.title,
          content: this.content,
          position_x: newX,
          position_y: newY
        });
      } catch (error) {
        console.error('Failed to update position:', error);
      }
    },
    onContextMenu(event) {
      event.preventDefault();
      event.stopPropagation();

      // 编辑模式下不显示菜单
      if (this.isEditing) {
        return;
      }

      // 计算菜单位置，防止超出屏幕
      const menuWidth = 150;
      const menuHeight = 80;

      let x = event.clientX;
      let y = event.clientY;

      // 防止右边缘溢出
      if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 10;
      }

      // 防止底部溢出
      if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 10;
      }

      this.contextMenuX = x;
      this.contextMenuY = y;
      this.showContextMenu = true;
    },
    closeContextMenuOnOutsideClick(event) {
      const noteEl = this.$el;
      if (this.showContextMenu && !noteEl.contains(event.target)) {
        this.showContextMenu = false;
      }
    },

  },
  mounted() {
    document.addEventListener('click', this.closeContextMenuOnOutsideClick);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.closeContextMenuOnOutsideClick);
  }
};
</script>

<style scoped>
.note {
  position: absolute;
  width: 250px;
  min-height: 150px;
  background: #e3f2fd;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 16px;
  cursor: move;
  user-select: none;
  transition: box-shadow 0.2s;
}

.note:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.note-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.note-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 12px;
  color: #1565c0;
}

.note-text {
  flex: 1;
  font-size: 14px;
  color: #555;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.note-edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.edit-title {
  padding: 8px;
  border: 2px solid #2196f3;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  outline: none;
}

.edit-content {
  flex: 1;
  padding: 8px;
  border: 2px solid #2196f3;
  border-radius: 4px;
  font-size: 14px;
  resize: none;
  outline: none;
  font-family: inherit;
}

.btn-save {
  padding: 8px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.btn-save:hover {
  background: #45a049;
}

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  padding: 8px 0;
  z-index: 1000;
  min-width: 150px;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s;
  color: #212121;
  font-size: 14px;
}

.context-menu-item:hover {
  background: #f5f5f5;
}

.context-menu-item.danger {
  color: #f44336;
}

.context-menu-item.danger:hover {
  background: #ffebee;
}

.menu-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

/* 编辑模态框样式 */
.edit-modal {
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

.edit-modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 500px;
  height: 400px;
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

.edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 8px;
  border-bottom: 1px solid #eee;
}

.edit-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.edit-body {
  padding: 16px 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.edit-title {
  padding: 10px;
  border: 2px solid #2196f3;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  outline: none;
}

.edit-title:focus {
  border-color: #0d47a1;
}

.edit-content {
  flex: 1;
  padding: 10px;
  border: 2px solid #2196f3;
  border-radius: 4px;
  font-size: 14px;
  resize: none; /* 禁用调整大小，使用flex自动填充空间 */
  min-height: 200px;
  outline: none;
  font-family: inherit;
  overflow-y: auto;
}

.edit-content:focus {
  border-color: #0d47a1;
}

.edit-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #eee;
}

.btn-cancel, .btn-save {
  padding: 8px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.btn-cancel {
  background: #f5f5f5;
  color: #555;
}

.btn-cancel:hover {
  background: #e0e0e0;
}

.btn-save {
  background: #4caf50;
  color: white;
}

.btn-save:hover {
  background: #45a049;
}
</style>
