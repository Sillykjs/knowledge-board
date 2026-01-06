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
      isEditingTitle: false
    };
  },
  mounted() {
    this.loadNotes();
    // Load saved title and remark from localStorage if they exist
    const savedTitle = localStorage.getItem('noteWallTitle');
    const savedRemark = localStorage.getItem('noteWallRemark');

    if (savedTitle) {
      this.title = savedTitle;
    }

    if (savedRemark) {
      this.remark = savedRemark;
    }

    // Initialize temp variables with current values
    this.tempTitle = this.title;
    this.tempRemark = this.remark;
  },
  methods: {
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
    saveTitleAndRemark() {
      // Update the actual title and remark with temporary values
      this.title = this.tempTitle;
      this.remark = this.tempRemark;

      // Save the title and remark to local storage or a backend if needed
      localStorage.setItem('noteWallTitle', this.title);
      localStorage.setItem('noteWallRemark', this.remark);
      this.isEditingTitle = false;
    },
    cancelEdit() {
      // Reset temp values to current saved values
      this.tempTitle = this.title;
      this.tempRemark = this.remark;
      this.isEditingTitle = false;
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
</style>
