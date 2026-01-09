<template>
  <div id="app">
    <!-- 顶部标签栏 -->
    <div class="board-tabs" v-if="boards.length > 0">
      <div class="tabs-container">
        <div
          v-for="board in boards"
          :key="board.id"
          :class="['board-tab', { active: currentBoardId === board.id }]"
          @click="switchBoard(board.id)"
        >
          <span class="tab-title">{{ board.title }}</span>
          <button
            v-if="boards.length > 1"
            class="tab-close"
            @click.stop="confirmDeleteBoard(board.id)"
            :disabled="board.id === 1"
            :title="board.id === 1 ? '默认白板不能删除' : '关闭白板'"
          >
            ×
          </button>
          <span v-if="board.note_count > 0" class="tab-badge">{{ board.note_count }}</span>
        </div>
        <button class="add-tab-button" @click="createBoard" title="新建白板">+</button>
      </div>
    </div>

    <!-- 白板组件 -->
    <NoteWall
      v-if="currentBoardId"
      ref="noteWall"
      :board-id="currentBoardId"
      :board-title="currentBoard?.title"
      :board-remark="currentBoard?.remark"
      :key="currentBoardId"
      @board-updated="onBoardUpdated"
    />

    <!-- 删除白板确认模态框 -->
    <Teleport to="body">
      <div v-if="showDeleteBoardConfirm" class="modal-overlay" @click="cancelDeleteBoard">
        <div class="modal-content" @click.stop>
          <h3>确认删除白板</h3>
          <p class="confirm-message">
            确定要删除白板 "{{ pendingDeleteBoard?.title }}" 吗？
            这将同时删除该白板下的所有便签和连接，此操作无法撤销。
          </p>
          <div class="modal-buttons">
            <button @click="cancelDeleteBoard" class="btn-cancel">取消</button>
            <button @click="confirmDeleteBoard" class="btn-delete">确认删除</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import axios from 'axios';
import NoteWall from './components/NoteWall.vue';

export default {
  name: 'App',
  components: {
    NoteWall
  },
  data() {
    return {
      boards: [],
      currentBoardId: 1,
      showDeleteBoardConfirm: false,
      pendingDeleteBoardId: null,
      boardViewports: {} // 存储每个白板的视口状态 { boardId: { scale, translateX, translateY } }
    };
  },
  computed: {
    currentBoard() {
      return this.boards.find(b => b.id === this.currentBoardId);
    },
    pendingDeleteBoard() {
      return this.boards.find(b => b.id === this.pendingDeleteBoardId);
    }
  },
  async mounted() {
    await this.loadBoards();
  },
  methods: {
    async loadBoards() {
      try {
        const response = await axios.get('/api/notes/boards');
        this.boards = response.data.boards;

        // 如果当前白板不存在，切换到第一个白板
        if (!this.boards.find(b => b.id === this.currentBoardId)) {
          this.currentBoardId = this.boards[0]?.id || 1;
        }
      } catch (error) {
        console.error('Failed to load boards:', error);
      }
    },

    switchBoard(boardId) {
      // 保存当前白板的视口状态
      if (this.$refs.noteWall) {
        this.boardViewports[this.currentBoardId] = {
          scale: this.$refs.noteWall.viewport.scale,
          translateX: this.$refs.noteWall.viewport.translateX,
          translateY: this.$refs.noteWall.viewport.translateY
        };
      }

      // 切换白板
      this.currentBoardId = boardId;

      // 恢复目标白板的视口状态
      this.$nextTick(() => {
        if (this.$refs.noteWall && this.boardViewports[boardId]) {
          Object.assign(this.$refs.noteWall.viewport, this.boardViewports[boardId]);
        }
      });
    },

    async createBoard() {
      const title = prompt('请输入新白板标题：', '新白板');
      if (!title || title.trim() === '') return;

      try {
        const response = await axios.post('/api/notes/boards', {
          title: title.trim(),
          remark: ''
        });

        this.boards.push(response.data.board);
        this.currentBoardId = response.data.board.id;
      } catch (error) {
        console.error('Failed to create board:', error);
        alert('创建白板失败：' + (error.response?.data?.error || error.message));
      }
    },

    confirmDeleteBoard(boardId) {
      const board = this.boards.find(b => b.id === boardId);
      if (!board) return;

      this.pendingDeleteBoardId = boardId;
      this.showDeleteBoardConfirm = true;
    },

    async confirmDeleteBoard() {
      const boardId = this.pendingDeleteBoardId;
      this.showDeleteBoardConfirm = false;

      try {
        await axios.delete(`/api/notes/boards/${boardId}`);
        this.boards = this.boards.filter(b => b.id !== boardId);

        // 如果删除的是当前白板，切换到第一个白板
        if (this.currentBoardId === boardId) {
          this.currentBoardId = this.boards[0]?.id || 1;
        }
      } catch (error) {
        console.error('Failed to delete board:', error);
        alert('删除白板失败：' + (error.response?.data?.error || error.message));
      }
    },

    cancelDeleteBoard() {
      this.showDeleteBoardConfirm = false;
      this.pendingDeleteBoardId = null;
    },

    onBoardUpdated(boardData) {
      const index = this.boards.findIndex(b => b.id === boardData.id);
      if (index !== -1) {
        this.boards.splice(index, 1, { ...this.boards[index], ...boardData });
      }
    }
  }
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  overflow: hidden;
}

#app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 顶部标签栏样式 */
.board-tabs {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 50px;
  background: white;
  border-bottom: 2px solid #e0e0e0;
  z-index: 2000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tabs-container {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 20px;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
}

.tabs-container::-webkit-scrollbar {
  height: 4px;
}

.tabs-container::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 2px;
}

.tabs-container::-webkit-scrollbar-thumb:hover {
  background: #aaa;
}

.board-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f5f5f5;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  user-select: none;
  border: 2px solid transparent;
}

.board-tab:hover {
  background: #e8e8e8;
}

.board-tab.active {
  background: white;
  border-color: #e0e0e0;
  border-bottom-color: white;
  font-weight: bold;
}

.tab-title {
  font-size: 14px;
  color: #333;
  white-space: nowrap;
}

.tab-close {
  width: 20px;
  height: 20px;
  border: none;
  background: #ddd;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.tab-close:hover:not(:disabled) {
  background: #ff5252;
  color: white;
}

.tab-close:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.tab-badge {
  background: #2196F3;
  color: white;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.add-tab-button {
  width: 32px;
  height: 32px;
  border: none;
  background: #4caf50;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.add-tab-button:hover {
  background: #45a049;
  transform: scale(1.1);
}

/* 模态框样式 */
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
  z-index: 3000;
}

.modal-content {
  background-color: white;
  padding: 25px;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.modal-content h3 {
  margin-bottom: 15px;
  color: #333;
}

.confirm-message {
  color: #666;
  font-size: 1rem;
  line-height: 1.5;
  margin: 15px 0;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.btn-cancel, .btn-delete {
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
  background-color: #aaa;
}

.btn-delete {
  background-color: #f44336;
  color: white;
}

.btn-delete:hover {
  background-color: #d32f2f;
}
</style>
