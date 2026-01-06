<template>
  <div
    class="note"
    :style="{ left: position_x + 'px', top: position_y + 'px' }"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @contextmenu.prevent="onContextMenu"
  >
    <div v-if="!isEditing" class="note-content">
      <h3 class="note-title">{{ title }}</h3>
      <p class="note-text">{{ content }}</p>
    </div>
    <div v-else class="note-edit" ref="editContainer">
      <input
        v-model="editTitle"
        class="edit-title"
        placeholder="标题"
        @keyup.enter="saveEdit"
      />
      <textarea
        v-model="editContent"
        class="edit-content"
        placeholder="内容"
      ></textarea>
      <button @click="saveEdit" class="btn-save">保存</button>
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
      isEditing: false,
      editTitle: this.title,
      editContent: this.content,
      dragOffsetX: 0,
      dragOffsetY: 0,
      showContextMenu: false,
      contextMenuX: 0,
      contextMenuY: 0
    };
  },
  methods: {
    onDragStart(e) {
      if (this.isEditing) {
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

    setupEditFocusListener() {
      // 为编辑区域内的元素添加事件监听器
      this.$nextTick(() => {
        const editContainer = this.$refs.editContainer;
        if (editContainer) {
          const inputs = editContainer.querySelectorAll('input, textarea, button');
          inputs.forEach(input => {
            input.addEventListener('blur', this.onEditElementBlur, true);
          });
        }
      });
    },

    onEditElementBlur(event) {
      // 使用 setTimeout 确保在所有事件处理完成后检查焦点
      setTimeout(() => {
        if (document.activeElement && this.$refs.editContainer) {
          const isFocusInside = this.$refs.editContainer.contains(document.activeElement);
          if (!isFocusInside) {
            this.saveEdit();
          }
        }
      }, 0);
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
      this.isEditing = true;
      this.editTitle = this.title;
      this.editContent = this.content;
      this.setupEditFocusListener();
    },
    async saveEdit() {
      if (!this.isEditing) return;

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

        this.isEditing = false;
        this.removeEditFocusListener();
      } catch (error) {
        console.error('Failed to update note:', error);
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

    removeEditFocusListener() {
      // 移除编辑区域内的元素事件监听器
      this.$nextTick(() => {
        const editContainer = this.$refs.editContainer;
        if (editContainer) {
          const inputs = editContainer.querySelectorAll('input, textarea, button');
          inputs.forEach(input => {
            input.removeEventListener('blur', this.onEditElementBlur, true);
          });
        }
      });
    }
  },
  mounted() {
    document.addEventListener('click', this.closeContextMenuOnOutsideClick);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.closeContextMenuOnOutsideClick);
    this.removeEditFocusListener();
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
</style>
