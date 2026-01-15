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
        :current-model-name="currentModelName"
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
          <p class="model-hint">💡 选择厂商和模型，配置将从 JSON 中自动加载</p>

          <!-- 厂商选择 -->
          <div class="form-group">
            <label class="form-label">厂商</label>
            <select v-model="selectedProvider" @change="onProviderChange" class="form-select">
              <option value="">请选择厂商</option>
              <option v-for="provider in parsedModels" :key="provider.provider" :value="provider.provider">
                {{ provider.provider }}
              </option>
            </select>
          </div>

          <!-- 模型选择 -->
          <div class="form-group" v-if="selectedProvider && currentProviderModels.length > 0">
            <label class="form-label">模型</label>
            <select v-model="selectedModelFromList" @change="onModelFromListChange" class="form-select">
              <option value="">请选择模型</option>
              <option v-for="model in currentProviderModels" :key="model" :value="model">
                {{ model }}
              </option>
            </select>
          </div>

          <!-- 当前配置预览 -->
          <div v-if="selectedProvider && selectedModelFromList" class="config-preview">
            <p><strong>API Base:</strong> {{ modelConfig.apiBase }}</p>
            <p><strong>API Key:</strong> {{ modelConfig.apiKey ? '已配置 (' + modelConfig.apiKey.slice(0, 8) + '...)' : '未配置' }}</p>
            <p v-if="!modelConfig.apiKey" class="warning-text">⚠️ 请在"编辑模型列表"中配置 API Key</p>
          </div>

          <div class="modal-buttons">
            <button @click="openEditJsonModal" class="btn-secondary">编辑模型列表</button>
            <button @click="cancelModelModal" class="btn-cancel">取消</button>
            <button @click="confirmModelModal" class="btn-confirm">确认切换</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 编辑模型 JSON 模态框 -->
    <Teleport to="body">
      <div v-if="showEditJsonModal" class="modal-overlay" @click="cancelEditJson">
        <div class="modal-content modal-content-large" @click.stop>
          <h3>编辑模型配置 (JSON)</h3>
          <p class="model-hint">
            💡 在此编辑所有模型的配置。apiKey 为该厂商的统一密钥，所有模型共享。
            <br>格式: [{"provider":"厂商名","apiBase":"API地址","apiKey":"密钥","models":["模型1","模型2"]}]
          </p>
          <div class="form-group">
            <label class="form-label">模型配置 JSON</label>
            <textarea
              v-model="modelsJson"
              class="form-textarea json-editor"
              rows="15"
              placeholder='[{"provider":"OpenAI","apiBase":"https://api.openai.com/v1","apiKey":"sk-xxx","models":["gpt-4","gpt-3.5-turbo"]}]'
            ></textarea>
          </div>
          <div class="modal-buttons">
            <button @click="formatJson" class="btn-secondary">格式化 JSON</button>
            <button @click="validateAndSaveJson" class="btn-confirm">保存配置</button>
            <button @click="cancelEditJson" class="btn-cancel">取消</button>
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
      modelConfig: { // 当前使用的模型配置
        apiBase: '',
        apiKey: '',
        model: ''
      },
      showEditJsonModal: false, // 控制编辑 JSON 模态框显示
      modelsJson: '', // 模型配置 JSON 字符串
      parsedModels: [], // 解析后的模型列表
      selectedProvider: '', // 选中的厂商
      selectedModelFromList: '', // 从列表中选中的模型
      currentModelName: 'AI' // 当前选择的模型名称（响应式）
    };
  },
  computed: {
    currentBoard() {
      return this.boards.find(b => b.id === this.currentBoardId);
    },
    pendingDeleteBoard() {
      return this.boards.find(b => b.id === this.pendingDeleteBoardId);
    },
    currentProviderModels() {
      if (!this.selectedProvider || !this.parsedModels.length) return [];
      const provider = this.parsedModels.find(p => p.provider === this.selectedProvider);
      return provider?.models || [];
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
    this.loadModelsJson();
    this.loadCurrentModelName();
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
      // 这个方法现在不需要做太多，因为配置都是从 JSON 读取
      // 只是保留接口以避免错误
    },

    // 加载当前模型名称
    loadCurrentModelName() {
      const lastUsedModel = localStorage.getItem('lastUsedModel');
      if (lastUsedModel) {
        const parts = lastUsedModel.split('|');
        if (parts.length === 2) {
          this.currentModelName = parts[1]; // 设置当前模型名称
        }
      }
    },

    openModelModal() {
      this.showModelModal = true;
      this.selectedProvider = '';
      this.selectedModelFromList = '';

      // 加载上次使用的厂商和模型
      const lastUsedModel = localStorage.getItem('lastUsedModel');
      if (lastUsedModel) {
        const parts = lastUsedModel.split('|');
        if (parts.length === 2) {
          this.selectedProvider = parts[0];
          this.selectedModelFromList = parts[1];

          // 从 JSON 配置中加载
          const provider = this.parsedModels.find(p => p.provider === this.selectedProvider);
          if (provider) {
            this.modelConfig = {
              apiBase: provider.apiBase,
              apiKey: provider.apiKey || '',
              model: this.selectedModelFromList
            };
          }
        }
      } else {
        this.modelConfig = { apiBase: '', apiKey: '', model: '' };
      }
    },

    cancelModelModal() {
      this.showModelModal = false;
      this.selectedProvider = '';
      this.selectedModelFromList = '';
    },

    // 加载模型 JSON 配置
    loadModelsJson() {
      const savedJson = localStorage.getItem('modelsJson');
      if (savedJson) {
        this.modelsJson = savedJson;
        this.parseModelsJson();
      } else {
        // 使用默认配置
        const defaultModels = [
          {
            provider: 'OpenAI',
            apiBase: 'https://api.openai.com/v1',
            apiKey: '',
            models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo-preview']
          },
          {
            provider: 'DeepSeek',
            apiBase: 'https://api.deepseek.com/v1',
            apiKey: '',
            models: ['deepseek-chat', 'deepseek-coder']
          },
          {
            provider: '智谱AI',
            apiBase: 'https://open.bigmodel.cn/api/paas/v4',
            apiKey: '',
            models: ['glm-4-flash', 'glm-4', 'glm-4-plus', 'glm-4-air']
          },
          {
            provider: 'Ollama',
            apiBase: 'http://localhost:11434/v1',
            apiKey: 'ollama',
            models: ['llama2', 'llama3', 'mistral', 'codellama']
          },
          {
            provider: 'Anthropic',
            apiBase: 'https://api.anthropic.com/v1',
            apiKey: '',
            models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
          }
        ];
        this.modelsJson = JSON.stringify(defaultModels, null, 2);
        this.parseModelsJson();
      }
    },

    // 解析模型 JSON
    parseModelsJson() {
      try {
        this.parsedModels = JSON.parse(this.modelsJson);
      } catch (e) {
        console.error('Failed to parse models JSON:', e);
        this.parsedModels = [];
      }
    },

    // 打开 JSON 编辑模态框
    openEditJsonModal() {
      this.showEditJsonModal = true;
    },

    // 厂商改变事件
    onProviderChange() {
      this.selectedModelFromList = '';
      if (this.selectedProvider) {
        const provider = this.parsedModels.find(p => p.provider === this.selectedProvider);
        if (provider) {
          // 直接从 JSON 配置中读取
          this.modelConfig.apiBase = provider.apiBase;
          this.modelConfig.apiKey = provider.apiKey || '';
          this.modelConfig.model = '';
        }
      }
    },

    // 从列表选择模型
    onModelFromListChange() {
      if (this.selectedModelFromList) {
        this.modelConfig.model = this.selectedModelFromList;
        // API Base 和 API Key 已在厂商选择时设置
      }
    },

    confirmModelModal() {
      if (!this.selectedProvider || !this.selectedModelFromList) {
        alert('请选择厂商和模型');
        return;
      }

      if (!this.modelConfig.apiBase || !this.modelConfig.model) {
        alert('配置不完整，请检查 JSON 配置');
        return;
      }

      // 保存最后使用的厂商和模型
      const key = `${this.selectedProvider}|${this.selectedModelFromList}`;
      localStorage.setItem('lastUsedModel', key);

      // 更新当前模型名称（响应式更新）
      this.currentModelName = this.selectedModelFromList;

      this.showModelModal = false;
      console.log('已切换到模型:', key);
    },

    // 格式化 JSON
    formatJson() {
      try {
        const parsed = JSON.parse(this.modelsJson);
        this.modelsJson = JSON.stringify(parsed, null, 2);
        this.parseModelsJson();
      } catch (e) {
        alert('JSON 格式错误，请检查语法');
      }
    },

    // 验证并保存 JSON
    validateAndSaveJson() {
      try {
        const parsed = JSON.parse(this.modelsJson);

        // 验证必需字段
        if (!Array.isArray(parsed)) {
          throw new Error('JSON 必须是数组格式');
        }

        for (const item of parsed) {
          if (!item.provider || !item.apiBase || !item.models || !Array.isArray(item.models)) {
            throw new Error('每个模型必须包含 provider、apiBase 和 models 字段');
          }
        }

        // 保存到 localStorage
        localStorage.setItem('modelsJson', this.modelsJson);
        this.parseModelsJson();

        // 关闭模态框
        this.showEditJsonModal = false;
        this.selectedProvider = '';
        this.selectedModelFromList = '';

        alert('模型配置已保存');
      } catch (e) {
        alert('JSON 格式错误: ' + e.message);
      }
    },

    // 取消编辑 JSON
    cancelEditJson() {
      this.showEditJsonModal = false;
      // 重新加载原来的配置
      this.loadModelsJson();
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

/* 次要按钮 */
.btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  background-color: #9c27b0;
  color: white;
  margin-right: auto;
}

.btn-secondary:hover {
  background-color: #7b1fa2;
}

/* 大尺寸模态框 */
.modal-content-large {
  max-width: 800px;
  width: 90%;
}

/* JSON 编辑器 */
.json-editor {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  background: #f8f8f8;
  border: 1px solid #ddd;
}

/* 配置预览 */
.config-preview {
  background: #f0f0f0;
  padding: 12px;
  border-radius: 4px;
  margin-top: 15px;
  border-left: 3px solid #9c27b0;
}

.config-preview p {
  margin: 5px 0;
  font-size: 13px;
  color: #333;
}

.config-preview strong {
  color: #666;
  min-width: 80px;
  display: inline-block;
}

.warning-text {
  color: #ff9800 !important;
  font-weight: 500;
  margin-top: 8px !important;
}
</style>
