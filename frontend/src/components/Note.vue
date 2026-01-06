<template>
  <div
    class="note"
    :style="{ left: position_x + 'px', top: position_y + 'px' }"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <div v-if="!isEditing" class="note-content">
      <h3 class="note-title">{{ title }}</h3>
      <p class="note-text">{{ content }}</p>
      <div class="note-actions">
        <button @click="startEdit" class="btn-edit">编辑</button>
        <button @click="deleteNote" class="btn-delete">删除</button>
      </div>
    </div>
    <div v-else class="note-edit">
      <input
        v-model="editTitle"
        class="edit-title"
        placeholder="标题"
        @blur="saveEdit"
        @keyup.enter="saveEdit"
      />
      <textarea
        v-model="editContent"
        class="edit-content"
        placeholder="内容"
        @blur="saveEdit"
      ></textarea>
      <button @click="saveEdit" class="btn-save">保存</button>
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
      dragOffsetY: 0
    };
  },
  methods: {
    onDragStart(e) {
      if (this.isEditing) {
        e.preventDefault();
        return;
      }
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
      this.isEditing = true;
      this.editTitle = this.title;
      this.editContent = this.content;
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
      } catch (error) {
        console.error('Failed to update note:', error);
      }
    },
    async deleteNote() {
      if (!confirm('确定要删除这个便签吗？')) return;

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
    }
  }
};
</script>

<style scoped>
.note {
  position: absolute;
  width: 250px;
  min-height: 150px;
  background: #fff740;
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
  color: #333;
}

.note-text {
  flex: 1;
  font-size: 14px;
  color: #555;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.note-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.note-actions button {
  flex: 1;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-edit {
  background: #2196f3;
  color: white;
}

.btn-edit:hover {
  background: #1976d2;
}

.btn-delete {
  background: #f44336;
  color: white;
}

.btn-delete:hover {
  background: #d32f2f;
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
</style>
