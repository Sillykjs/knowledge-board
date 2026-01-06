<template>
  <div
    class="note-wall"
    @dragover.prevent
    @drop="onDrop"
  >
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
      notes: []
    };
  },
  mounted() {
    this.loadNotes();
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
      const offsetY = Math.floor(this.notes.length / 5) * 200 + 50;
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
</style>
