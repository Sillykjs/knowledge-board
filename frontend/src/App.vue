<template>
  <div id="app">
    <!-- 左侧边栏 -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }" :style="sidebarStyle" v-if="boards.length > 0">
      <!-- 切换按钮 -->
      <button class="sidebar-toggle" @click="toggleSidebar" :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'">
        {{ sidebarCollapsed ? '▶' : '◀' }}
      </button>

      <!-- 白板列表 -->
      <div class="board-list">
        <draggable
          v-model="boards"
          item-key="id"
          :disabled="sidebarCollapsed"
          ghost-class="ghost-board"
          drag-class="dragging-board"
          animation="300"
          @end="onDragEnd"
        >
          <template #item="{ element: board }">
            <div
              :class="['board-item', { active: currentBoardId === board.id }]"
              @click="switchBoard(board.id)"
            >
              <!-- 展开状态：显示完整信息 -->
              <template v-if="!sidebarCollapsed">
                <span class="drag-handle">⋮⋮</span>
                <span class="board-title">{{ board.title }}</span>
                <div class="board-actions">
                  <span v-if="board.note_count > 0" class="board-badge">
                    {{ board.note_count }}
                  </span>
                  <button
                    v-if="boards.length > 1"
                    class="board-delete"
                    @click.stop="askDeleteBoard(board.id)"
                    :disabled="board.id === 1"
                    :title="board.id === 1 ? '默认白板不能删除' : '删除白板'"
                  >
                    🗑️
                  </button>
                </div>
              </template>

              <!-- 收起状态：只显示图标 -->
              <template v-else>
                <div class="board-icon">
                  {{ currentBoardId === board.id ? '📌' : '📄' }}
                  <span v-if="board.note_count > 0" class="board-badge-mini">
                    {{ board.note_count }}
                  </span>
                </div>
              </template>
            </div>
          </template>
        </draggable>
      </div>

      <!-- 切换模型按钮 -->
      <button class="model-button" @click="openModelModal" :title="sidebarCollapsed ? '切换模型' : ''">
        <template v-if="!sidebarCollapsed">
          <span class="model-icon">🤖</span>
          <span class="model-text">切换模型</span>
        </template>
        <template v-else>
          <span class="model-icon">🤖</span>
        </template>
      </button>

      <!-- 新建白板按钮 -->
      <button class="add-board-button" @click="createBoard" :title="sidebarCollapsed ? '新建白板' : ''">
        <template v-if="!sidebarCollapsed">
          <span class="add-icon">+</span>
          <span class="add-text">新建白板</span>
        </template>
        <template v-else>
          <span class="add-icon">+</span>
        </template>
      </button>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content" :style="mainContentStyle">
      <!-- 白板组件 -->
      <NoteWall
        v-if="currentBoardId"
        ref="noteWall"
        :board-id="currentBoardId"
        :board-title="currentBoard?.title"
        :board-system-prompt="currentBoard?.system_prompt"
        :key="currentBoardId"
        @board-updated="onBoardUpdated"
        @note-count-changed="onNoteCountChanged"
      />
    </main>

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

    <!-- 创建白板模态框 -->
    <Teleport to="body">
      <div v-if="showCreateBoardModal" class="modal-overlay" @click="cancelCreateBoard">
        <div class="modal-content" @click.stop>
          <h3>创建新白板</h3>
          <div class="form-group">
            <label class="form-label">白板标题</label>
            <input
              v-model="newBoardTitle"
              class="form-input"
              placeholder="请输入白板标题"
              @keyup.enter="confirmCreateBoard"
              ref="titleInput"
            />
          </div>
          <div class="form-group">
            <label class="form-label">系统提示词（可选）</label>
            <textarea
              v-model="newBoardSystemPrompt"
              class="form-textarea"
              placeholder="请输入系统提示词"
              rows="4"
            ></textarea>
          </div>
          <div class="modal-buttons">
            <button @click="cancelCreateBoard" class="btn-cancel">取消</button>
            <button @click="confirmCreateBoard" class="btn-confirm">确认创建</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 切换模型模态框 -->
    <Teleport to="body">
      <div v-if="showModelModal" class="modal-overlay" @click="cancelModelModal">
        <div class="modal-content" @click.stop>
          <h3>切换模型</h3>
          <p class="model-hint">💡 每个模型的配置会单独保存，切换时会自动加载对应的配置</p>
          <div class="form-group">
            <label class="form-label">预设模型</label>
            <select v-model="selectedModelPreset" @change="onModelPresetChange" class="form-select">
              <option value="">自定义</option>
              <option value="openai">OpenAI (GPT-4/GPT-3.5)</option>
              <option value="deepseek">DeepSeek</option>
              <option value="zhipu">智谱AI (GLM-4)</option>
              <option value="ollama">Ollama (本地)</option>
              <option value="claude">Anthropic Claude</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">API Base URL</label>
            <input
              v-model="modelConfig.apiBase"
              class="form-input"
              placeholder="例如: https://api.openai.com/v1"
            />
          </div>
          <div class="form-group">
            <label class="form-label">API Key</label>
            <input
              v-model="modelConfig.apiKey"
              type="password"
              class="form-input"
              placeholder="请输入 API Key"
            />
          </div>
          <div class="form-group">
            <label class="form-label">模型名称</label>
            <input
              v-model="modelConfig.model"
              class="form-input"
              placeholder="例如: gpt-4, deepseek-chat"
            />
          </div>
          <div class="modal-buttons">
            <button @click="cancelModelModal" class="btn-cancel">取消</button>
            <button @click="confirmModelModal" class="btn-confirm">确认切换</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import axios from 'axios';
import NoteWall from './components/NoteWall.vue';
import draggable from 'vuedraggable';

export default {
  name: 'App',
  components: {
    NoteWall,
    draggable
  },
  data() {
    return {
      boards: [],
      currentBoardId: 1,
      showDeleteBoardConfirm: false,
      pendingDeleteBoardId: null,
      boardViewports: {}, // 存储每个白板的视口状态 { boardId: { scale, translateX, translateY } }
      sidebarCollapsed: false, // 侧边栏是否收起
      sidebarWidth: 250, // 展开时的宽度（px）
      collapsedWidth: 60, // 收起时的宽度（px）
      showCreateBoardModal: false, // 控制创建白板模态框显示
      newBoardTitle: '', // 新白板标题
      newBoardSystemPrompt: '', // 新白板系统提示词
      showModelModal: false, // 控制模型切换模态框显示
      selectedModelPreset: '', // 选中的预设模型
      modelConfigs: {}, // 所有模型的配置 { openai: {...}, deepseek: {...}, ... }
      modelConfig: { // 当前使用的模型配置
        apiBase: '',
        apiKey: '',
        model: ''
      },
      modelPresets: { // 预设模型配置
        openai: {
          apiBase: 'https://api.openai.com/v1',
          model: 'gpt-3.5-turbo'
        },
        deepseek: {
          apiBase: 'https://api.deepseek.com/v1',
          model: 'deepseek-chat'
        },
        zhipu: {
          apiBase: 'https://open.bigmodel.cn/api/paas/v4',
          model: 'glm-4-flash'
        },
        ollama: {
          apiBase: 'http://localhost:11434/v1',
          model: 'llama2'
        },
        claude: {
          apiBase: 'https://api.anthropic.com/v1',
          model: 'claude-3-sonnet'
        }
      }
    };
  },
  computed: {
    currentBoard() {
      return this.boards.find(b => b.id === this.currentBoardId);
    },
    pendingDeleteBoard() {
      return this.boards.find(b => b.id === this.pendingDeleteBoardId);
    },
    sidebarStyle() {
      return {
        width: this.sidebarCollapsed ? `${this.collapsedWidth}px` : `${this.sidebarWidth}px`
      };
    },
    mainContentStyle() {
      return {
        marginLeft: this.sidebarCollapsed ? `${this.collapsedWidth}px` : `${this.sidebarWidth}px`
      };
    }
  },
  async mounted() {
    await this.loadBoards();
    this.loadModelConfig();
  },
  watch: {
    showCreateBoardModal(newVal) {
      if (newVal) {
        // 模态框打开时，自动聚焦到标题输入框
        this.$nextTick(() => {
          if (this.$refs.titleInput) {
            this.$refs.titleInput.focus();
            this.$refs.titleInput.select();
          }
        });
      }
    }
  },
  methods: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },
    async loadBoards() {
      try {
        // 保存更新前的状态（判断是否为初始化加载）
        const hadBoards = this.boards.length > 0;

        const response = await axios.get('/api/notes/boards');
        this.boards = response.data.boards;

        // 只在初始化时（boards 列表为空）才自动切换到第一个白板
        // 避免在便签数量变化时意外切换白板
        if (!hadBoards && this.boards.length > 0) {
          this.currentBoardId = this.boards[0].id;
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

    createBoard() {
      // 打开创建白板模态框
      this.newBoardTitle = '新话题';
      this.newBoardSystemPrompt = '你好，我是默认助手。你可以立刻开始跟我聊天';
      this.showCreateBoardModal = true;
    },

    async confirmCreateBoard() {
      if (!this.newBoardTitle || this.newBoardTitle.trim() === '') return;

      try {
        const response = await axios.post('/api/notes/boards', {
          title: this.newBoardTitle.trim(),
          system_prompt: this.newBoardSystemPrompt.trim()
        });

        // 关闭模态框
        this.showCreateBoardModal = false;

        // 重新加载白板列表以确保排序正确
        await this.loadBoards();
        this.currentBoardId = response.data.board.id;
      } catch (error) {
        console.error('Failed to create board:', error);
        alert('创建白板失败：' + (error.response?.data?.error || error.message));
      }
    },

    cancelCreateBoard() {
      this.showCreateBoardModal = false;
      this.newBoardTitle = '';
      this.newBoardSystemPrompt = '';
    },

    askDeleteBoard(boardId) {
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
    },

    async onNoteCountChanged() {
      // 当便签数量变化时，重新加载白板列表以更新 note_count
      await this.loadBoards();
    },

    // 拖拽结束时保存排序
    async onDragEnd() {
      // 保存新的排序到后端
      const boardOrders = this.boards.map((board, index) => ({
        id: board.id,
        sort_order: index
      }));

      try {
        await axios.put('/api/notes/boards/reorder', { boardOrders });
        console.log('Board order saved successfully');
      } catch (error) {
        console.error('Failed to save board order:', error);
        // 失败时重新加载数据
        await this.loadBoards();
      }
    },

    // 模型配置相关方法
    loadModelConfig() {
      // 加载所有保存的模型配置
      const savedConfigs = localStorage.getItem('aiModelConfigs');
      if (savedConfigs) {
        try {
          this.modelConfigs = JSON.parse(savedConfigs);
        } catch (error) {
          console.error('Failed to parse model configs:', error);
          this.modelConfigs = {};
        }
      }

      // 如果有保存的当前选中模型，加载它的配置
      const lastUsedModel = localStorage.getItem('lastUsedModel');
      if (lastUsedModel && this.modelConfigs[lastUsedModel]) {
        this.modelConfig = { ...this.modelConfigs[lastUsedModel] };
      } else if (this.modelConfigs['openai']) {
        // 默认加载 OpenAI 配置
        this.modelConfig = { ...this.modelConfigs['openai'] };
      }
    },

    saveModelConfig() {
      // 如果选择了预设，保存到对应的模型配置中
      if (this.selectedModelPreset) {
        this.modelConfigs[this.selectedModelPreset] = { ...this.modelConfig };
        localStorage.setItem('aiModelConfigs', JSON.stringify(this.modelConfigs));
        localStorage.setItem('lastUsedModel', this.selectedModelPreset);
      } else {
        // 自定义配置保存到 custom
        this.modelConfigs['custom'] = { ...this.modelConfig };
        localStorage.setItem('aiModelConfigs', JSON.stringify(this.modelConfigs));
        localStorage.setItem('lastUsedModel', 'custom');
      }
    },

    openModelModal() {
      this.showModelModal = true;

      // 加载上次使用的模型配置
      const lastUsedModel = localStorage.getItem('lastUsedModel');
      if (lastUsedModel && this.modelConfigs[lastUsedModel]) {
        this.selectedModelPreset = lastUsedModel;
        this.modelConfig = { ...this.modelConfigs[lastUsedModel] };
      } else if (this.modelConfigs['openai']) {
        this.selectedModelPreset = 'openai';
        this.modelConfig = { ...this.modelConfigs['openai'] };
      } else {
        this.selectedModelPreset = '';
        this.modelConfig = { apiBase: '', apiKey: '', model: '' };
      }
    },

    cancelModelModal() {
      this.showModelModal = false;
      this.selectedModelPreset = '';
    },

    onModelPresetChange() {
      if (this.selectedModelPreset && this.modelPresets[this.selectedModelPreset]) {
        const preset = this.modelPresets[this.selectedModelPreset];

        // 如果该模型有保存的配置，加载保存的配置
        if (this.modelConfigs[this.selectedModelPreset]) {
          this.modelConfig = { ...this.modelConfigs[this.selectedModelPreset] };
        } else {
          // 否则使用预设值，但清空 API Key
          this.modelConfig = {
            apiBase: preset.apiBase,
            model: preset.model,
            apiKey: ''
          };
        }
      } else {
        // 自定义模式，清空配置
        this.modelConfig = { apiBase: '', apiKey: '', model: '' };
      }
    },

    confirmModelModal() {
      if (!this.modelConfig.apiBase || !this.modelConfig.model) {
        alert('请填写 API Base URL 和模型名称');
        return;
      }

      this.saveModelConfig();
      this.showModelModal = false;

      // 可选：显示提示信息
      console.log('模型配置已保存:', this.modelConfig);
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
  flex-direction: row;
  overflow: hidden;
}

/* 侧边栏样式 */
.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  background: white;
  border-right: 2px solid #e0e0e0;
  z-index: 2000;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  overflow: hidden;
}

.sidebar-toggle {
  position: absolute;
  top: 10px;
  right: -10px;
  width: 24px;
  height: 24px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2001;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.sidebar-toggle:hover {
  background: #f5f5f5;
  transform: scale(1.1);
  right: -2px;
}

.board-list {
  flex: 1;
  overflow-y: auto;
  padding: 60px 16px 10px 16px;
  display: flex;
  flex-direction: column;
  position: relative;
}

.board-list::-webkit-scrollbar {
  width: 4px;
}

.board-list::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 2px;
}

.board-list::-webkit-scrollbar-thumb:hover {
  background: #aaa;
}

.board-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f5f5f5;
  border-radius: 6px;
  cursor: grab;
  user-select: none;
  border: 2px solid transparent;
  position: relative;
  margin-bottom: 8px;
  width: 100%;
  transition: all 0.2s;
}

.board-item:hover {
  background: #e8e8e8;
}

.board-item.active {
  background: white;
  border-color: #2196F3;
  font-weight: bold;
  box-shadow: 0 2px 6px rgba(33, 150, 243, 0.2);
  cursor: pointer;
}

.board-item:active {
  cursor: grabbing;
}

/* VueDraggable 拖拽样式 */
.ghost-board {
  opacity: 0.4;
  background: #e3f2fd;
  border: 2px dashed #2196F3;
}

.dragging-board {
  opacity: 1;
  transform: rotate(2deg);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.drag-handle {
  color: #999;
  cursor: grab;
  margin-right: 8px;
  user-select: none;
  opacity: 0.4;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  flex-shrink: 0;
}

.drag-handle svg {
  display: block;
}

.board-item:hover .drag-handle {
  opacity: 0.8;
  color: #666;
  background: rgba(0, 0, 0, 0.05);
  transform: scale(1.1);
}

.board-item.dragging .drag-handle {
  opacity: 1;
  color: #2196F3;
  background: rgba(33, 150, 243, 0.1);
  transform: scale(1.15);
}

.drag-handle:active {
  cursor: grabbing;
}

.board-title {
  font-size: 14px;
  color: #333;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.board-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.board-badge {
  background: #2196F3;
  color: white;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.board-delete {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.6;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.board-delete:hover:not(:disabled) {
  opacity: 1;
  background: #ff5252;
  border-radius: 4px;
  color: white;
}

.board-delete:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.board-icon {
  width: 100%;
  height: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  position: relative;
}

.board-badge-mini {
  position: absolute;
  top: -2px;
  right: -2px;
  background: #2196F3;
  color: white;
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 8px;
  min-width: 14px;
  text-align: center;
}

.add-board-button {
  margin: 5px 10px 10px 10px;
  padding: 12px 16px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  font-size: 14px;
}

.add-board-button:hover {
  background: #45a049;
  transform: scale(1.02);
}

.add-icon {
  font-size: 18px;
  font-weight: bold;
}

.add-text {
  font-weight: 500;
}

.sidebar.collapsed .add-board-button {
  padding: 12px;
}

.sidebar.collapsed .add-text {
  display: none;
}

.main-content {
  flex: 1;
  height: 100vh;
  overflow: hidden;
  transition: margin-left 0.3s ease;
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

/* 创建白板模态框样式 */
.form-group {
  margin-bottom: 15px;
}

.form-label {
  display: block;
  margin-bottom: 5px;
  color: #333;
  font-weight: 500;
  font-size: 14px;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: #2196F3;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.btn-confirm {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  background-color: #4caf50;
  color: white;
}

.btn-confirm:hover {
  background-color: #45a049;
}

/* 切换模型按钮样式 */
.model-button {
  margin: 5px 10px;
  padding: 12px 16px;
  background: #9c27b0;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  font-size: 14px;
}

.model-button:hover {
  background: #7b1fa2;
  transform: scale(1.02);
}

.model-icon {
  font-size: 18px;
  font-weight: bold;
}

.model-text {
  font-weight: 500;
}

.sidebar.collapsed .model-button {
  padding: 12px;
}

.sidebar.collapsed .model-text {
  display: none;
}

/* 模型配置表单样式 */
.form-select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.2s;
  background-color: white;
  cursor: pointer;
}

.form-select:focus {
  outline: none;
  border-color: #9c27b0;
}

.form-select:hover {
  border-color: #7b1fa2;
}

/* 模型配置提示 */
.model-hint {
  font-size: 13px;
  color: #666;
  background: #f5f5f5;
  padding: 10px 12px;
  border-radius: 4px;
  margin-bottom: 15px;
  border-left: 3px solid #9c27b0;
}
</style>
