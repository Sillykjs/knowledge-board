<template>
  <div id="app">
    <!-- 左侧边栏 -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }" :style="sidebarStyle" v-if="boards.length > 0">
      <!-- 切换按钮 -->
      <button
        class="sidebar-toggle"
        :class="{ collapsed: sidebarCollapsed }"
        @click="toggleSidebar"
        :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
      >
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
              @contextmenu.prevent="showBoardContextMenu($event, board)"
            >
              <!-- 展开状态：显示完整信息 -->
              <template v-if="!sidebarCollapsed">
                <span class="drag-handle">⋮⋮</span>
                <span class="board-title">{{ board.title }}</span>
                <div class="board-actions">
                  <span v-if="filteredBoardCounts[board.id] > 0" class="board-badge">
                    {{ filteredBoardCounts[board.id] }}
                  </span>
                </div>
              </template>

              <!-- 收起状态：只显示图标 -->
              <template v-else>
                <div class="board-icon">
                  {{ currentBoardId === board.id ? '📌' : '📄' }}
                  <span v-if="filteredBoardCounts[board.id] > 0" class="board-badge-mini">
                    {{ filteredBoardCounts[board.id] }}
                  </span>
                </div>
              </template>
            </div>
          </template>
        </draggable>
      </div>

      <!-- 模型管理按钮 -->
      <button class="model-button" @click="openEditJsonModal" :title="sidebarCollapsed ? '模型管理' : ''">
        <span class="model-icon">🤖</span>
        <span class="model-text" v-show="!sidebarCollapsed">模型管理</span>
      </button>

      <!-- 新建白板按钮 -->
      <button class="add-board-button" @click="createBoard" :title="sidebarCollapsed ? '新建白板' : ''">
        <span class="add-icon">+</span>
        <span class="add-text" v-show="!sidebarCollapsed">新建白板</span>
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
        :available-models="parsedModels"
        :initial-note-id="initialNoteId"
        :key="currentBoardId"
        @board-updated="onBoardUpdated"
        @note-count-changed="onNoteCountChanged"
        @model-changed="onModelChanged"
        @notes-loaded="onNotesLoaded"
      />
    </main>

    <!-- 右侧便签索引边栏 -->
    <aside class="right-sidebar" :class="{ collapsed: rightSidebarCollapsed }">
      <!-- 便签列表 -->
      <div class="notes-index">
        <div class="notes-index-header">
          <h3>便签索引</h3>

          <!-- 增强搜索开关 -->
          <div class="advanced-search-toggle">
            <span class="toggle-label">增强搜索</span>
            <label class="switch">
              <input
                type="checkbox"
                v-model="advancedSearchEnabled"
              />
              <span class="slider round"></span>
            </label>
          </div>

          <span class="notes-count">{{ sortedNotes.length }}</span>
        </div>

        <!-- 搜索输入框 -->
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            :placeholder="advancedSearchEnabled ? '增强搜索：标题和内容' : '搜索所有便签的标题'"
            @input="onSearchInput"
          />
          <button
            v-if="searchQuery"
            class="search-clear"
            @click="clearSearch"
            title="清除搜索"
          >
            ✕
          </button>
        </div>

        <div class="notes-list">
          <div
            v-for="note in sortedNotes"
            :key="note.id"
            class="note-index-item"
            :class="{ 'cross-board': note.board_id !== currentBoardId }"
            @click="jumpToNote(note)"
            :title="`${note.title}\n所属白板: ${note.board_title}`"
          >
            <span class="note-index-title">{{ note.title }}</span>
            <span class="note-index-board" v-if="note.board_id !== currentBoardId">
              📋 {{ note.board_title }}
            </span>
            <span class="note-index-time">{{ formatNoteTime(note.created_at) }}</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- 右侧边栏切换按钮 -->
    <button
      class="right-sidebar-toggle"
      :class="{ collapsed: rightSidebarCollapsed }"
      @click="toggleRightSidebar"
      :title="rightSidebarCollapsed ? '展开便签索引' : '收起便签索引'"
    >
      {{ rightSidebarCollapsed ? '◀' : '▶' }}
    </button>

    <!-- 白板右键菜单 -->
    <Teleport to="body">
      <div
        v-if="boardContextMenuVisible"
        class="context-menu"
        :style="{ left: boardContextMenuPosition.x + 'px', top: boardContextMenuPosition.y + 'px' }"
        @click.stop
      >
        <div
          v-if="contextMenuBoard"
          class="context-menu-item"
          @click="editBoard(contextMenuBoard)"
        >
          <span class="menu-icon">✏️</span>
          <span class="menu-text">编辑白板</span>
        </div>
        <div
          v-if="contextMenuBoard"
          class="context-menu-item"
          :class="{ disabled: contextMenuBoard.id === 1 || boards.length <= 1 }"
          @click="askDeleteBoard(contextMenuBoard.id)"
        >
          <span class="menu-icon">🗑️</span>
          <span class="menu-text">删除白板</span>
          <span v-if="contextMenuBoard.id === 1" class="menu-hint">默认白板</span>
        </div>
      </div>
    </Teleport>

    <!-- 点击其他地方关闭右键菜单 -->
    <div
      v-if="boardContextMenuVisible"
      class="context-menu-overlay"
      @click="hideBoardContextMenu"
    ></div>

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

    <!-- 编辑模型 JSON 模态框 -->
    <Teleport to="body">
      <div v-if="showEditJsonModal" class="modal-overlay" @click="cancelEditJson">
        <div class="modal-content modal-content-large" @click.stop>
          <h3>模型管理</h3>
          <p class="model-hint">
            💡 在此配置 AI 模型。切换模型请使用白板底部的模型选择器。
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
      showEditJsonModal: false, // 控制编辑 JSON 模态框显示
      modelsJson: '', // 模型配置 JSON 字符串（不含 id 和 _masked）
      parsedModels: [], // 解析后的模型列表（不含 id）
      fullModelConfigs: [], // 完整的模型配置（包含 id，用于保存时匹配）
      currentModelName: 'AI', // 当前选择的模型名称（响应式）
      rightSidebarCollapsed: true, // 右侧边栏是否收起
      currentNotes: [], // 当前白板的便签列表（用于右侧索引）
      searchQuery: '', // 搜索关键词
      advancedSearchEnabled: false, // 增强搜索是否启用
      allBoardsNotes: {}, // 缓存所有白板的便签数据 { boardId: [notes] }
      initialNoteId: null, // 跨白板跳转时指定的便签ID
      isJumping: false, // 防止并发跳转的标志位
      boardContextMenuVisible: false, // 白板右键菜单是否显示
      boardContextMenuPosition: { x: 0, y: 0 }, // 右键菜单位置
      contextMenuBoard: null // 当前右键菜单选中的白板
    };
  },
  computed: {
    // 计算每个白板在搜索关键词下的便签数量
    filteredBoardCounts() {
      const counts = {};
      const query = this.searchQuery.toLowerCase().trim();

      // 如果没有搜索关键词，返回原始数量（从 boards.note_count 获取）
      if (!query) {
        this.boards.forEach(board => {
          counts[board.id] = board.note_count || 0;
        });
        return counts;
      }

      // 根据搜索关键词计算每个白板的筛选后数量（支持 AND 搜索）
      this.boards.forEach(board => {
        const notes = this.allBoardsNotes[board.id] || [];
        // 将搜索词按空格分割成多个关键词（支持多个空格）
        const keywords = query.split(/\s+/).filter(k => k.length > 0);

        const filteredCount = notes.filter(note => {
          const titleLower = note.title ? note.title.toLowerCase() : '';
          const contentLower = note.content ? note.content.toLowerCase() : '';

          if (this.advancedSearchEnabled) {
            // 增强搜索：所有关键词都必须在标题或内容中匹配
            return keywords.every(keyword => {
              return titleLower.includes(keyword) || contentLower.includes(keyword);
            });
          } else {
            // 普通搜索：所有关键词都必须在标题中匹配
            return keywords.every(keyword => {
              return titleLower.includes(keyword);
            });
          }
        }).length;
        counts[board.id] = filteredCount;
      });

      return counts;
    },
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
        marginLeft: this.sidebarCollapsed ? `${this.collapsedWidth}px` : `${this.sidebarWidth}px`,
        marginRight: this.rightSidebarCollapsed ? '0' : '300px'
      };
    },
    // 获取所有白板的便签列表（按创建时间排序并搜索过滤）
    sortedNotes() {
      let allNotes = [];

      // 1. 收集所有白板的便签，并添加所属白板信息
      this.boards.forEach(board => {
        const boardNotes = (this.allBoardsNotes[board.id] || []).map(note => ({
          ...note,
          board_id: board.id,
          board_title: board.title
        }));
        allNotes.push(...boardNotes);
      });

      // 2. 根据搜索关键词过滤（支持 AND 搜索）
      if (this.searchQuery && this.searchQuery.trim() !== '') {
        const query = this.searchQuery.toLowerCase().trim();
        // 将搜索词按空格分割成多个关键词（支持多个空格）
        const keywords = query.split(/\s+/).filter(k => k.length > 0);

        allNotes = allNotes.filter(note => {
          const titleLower = note.title ? note.title.toLowerCase() : '';
          const contentLower = note.content ? note.content.toLowerCase() : '';

          if (this.advancedSearchEnabled) {
            // 增强搜索：所有关键词都必须在标题或内容中匹配
            return keywords.every(keyword => {
              return titleLower.includes(keyword) || contentLower.includes(keyword);
            });
          } else {
            // 普通搜索：所有关键词都必须在标题中匹配
            return keywords.every(keyword => {
              return titleLower.includes(keyword);
            });
          }
        });
      }

      // 3. 按创建时间排序（降序，新的在前）
      allNotes.sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateB - dateA;
      });

      // 4. 将当前白板的便签排在前面
      allNotes.sort((a, b) => {
        const aIsCurrent = a.board_id === this.currentBoardId ? 0 : 1;
        const bIsCurrent = b.board_id === this.currentBoardId ? 0 : 1;
        return aIsCurrent - bIsCurrent;
      });

      return allNotes;
    }
  },
  async mounted() {
    await this.loadBoards();
    this.loadModelsJson();
    this.loadCurrentModelName();

    // 自动聚焦到全局最新便签
    await this.focusOnLatestNote();
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

          // 初始化时加载所有白板的便签数据，用于搜索功能
          await this.loadAllBoardsNotes();
        }
      } catch (error) {
        console.error('Failed to load boards:', error);
      }
    },

    // 加载所有白板的便签数据（用于搜索功能）
    async loadAllBoardsNotes() {
      try {
        const promises = this.boards.map(async board => {
          const response = await axios.get('/api/notes', {
            params: { wall_id: board.id }
          });
          return { boardId: board.id, notes: response.data.notes || [] };
        });

        const results = await Promise.all(promises);

        // 创建新对象以触发响应式更新
        this.allBoardsNotes = Object.fromEntries(
          results.map(({ boardId, notes }) => [boardId, notes])
        );
      } catch (error) {
        console.error('Failed to load all boards notes:', error);
      }
    },

    async switchBoard(boardId) {
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

      // 等待 NoteWall 组件挂载完成
      await new Promise(resolve => {
        this.$nextTick(resolve);
      });

      // 等待组件完全挂载（可能需要两个 nextTick）
      await new Promise(resolve => {
        this.$nextTick(resolve);
      });

      // 恢复目标白板的视口状态（确保 noteWall 存在且视口数据存在）
      if (this.$refs.noteWall && this.$refs.noteWall.viewport && this.boardViewports[boardId]) {
        Object.assign(this.$refs.noteWall.viewport, this.boardViewports[boardId]);
      }
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

      // 如果是默认白板或只剩一个白板，不允许删除
      if (board.id === 1 || this.boards.length <= 1) {
        return;
      }

      // 关闭右键菜单
      this.hideBoardContextMenu();

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

      // 重新加载当前白板的便签数据（更新缓存，创建新对象引用）
      if (this.currentBoardId) {
        try {
          const response = await axios.get('/api/notes', {
            params: { wall_id: this.currentBoardId }
          });
          this.allBoardsNotes = {
            ...this.allBoardsNotes,
            [this.currentBoardId]: response.data.notes || []
          };
        } catch (error) {
          console.error('Failed to reload board notes:', error);
        }
      }
    },

    // 便签列表加载完成
    onNotesLoaded(notes) {
      this.currentNotes = notes;

      // 缓存当前白板的便签数据（创建新对象引用以触发响应式更新）
      if (this.currentBoardId) {
        this.allBoardsNotes = {
          ...this.allBoardsNotes,
          [this.currentBoardId]: [...notes]
        };
      }
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

    // 加载模型 JSON 配置（从后端获取）
    async loadModelsJson() {
      try {
        const response = await axios.get('/api/model-config');
        const configs = response.data;

        if (configs && configs.length > 0) {
          // 保存完整配置（包含 id），用于保存时匹配
          this.fullModelConfigs = configs;

          // 过滤掉内部字段（_masked、id），只显示用户需要的字段
          const cleanedConfigs = configs.map(item => {
            const { _masked, id, ...userFields } = item;  // 移除 _masked 和 id 字段
            return userFields;
          });
          this.modelsJson = JSON.stringify(cleanedConfigs, null, 2);
          this.parseModelsJson();
        } else {
          // 后端没有配置，使用默认模板
          const defaultModels = [
            {
              provider: 'OpenAI',
              apiBase: 'https://api.openai.com/v1',
              apiKey: '',  // 空字符串表示未配置
              models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo-preview']
            }
          ];
          this.modelsJson = JSON.stringify(defaultModels, null, 2);
          this.parseModelsJson();
        }
      } catch (error) {
        console.error('Failed to load model configs:', error);
        // 加载失败时使用默认配置
        const defaultModels = [
          {
            provider: 'OpenAI',
            apiBase: 'https://api.openai.com/v1',
            apiKey: '',
            models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo-preview']
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

    // 验证并保存 JSON（到后端）
    async validateAndSaveJson() {
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

        // 处理 API Key：如果 apiKey 是掩码格式（包含 ***），标记为保持原值
        const toSave = parsed.map(item => {
          const hasMaskedKey = item.apiKey && item.apiKey.includes('***');

          // 通过 provider 从完整配置中找到对应的 id
          const existingConfig = this.fullModelConfigs.find(c => c.provider === item.provider);
          const recordId = existingConfig ? existingConfig.id : undefined;

          if (hasMaskedKey && recordId) {
            // 用户没改密钥（有掩码且存在对应记录），告诉后端保持原值
            return {
              id: recordId,
              provider: item.provider,
              apiBase: item.apiBase,
              models: item.models,
              _keepOriginalKey: true
            };
          } else {
            // 用户新增或修改了密钥，保存新值
            return {
              id: recordId,  // 新增时 id 为 undefined
              provider: item.provider,
              apiBase: item.apiBase,
              apiKey: item.apiKey || '',
              models: item.models,
              _keepOriginalKey: false
            };
          }
        });

        // 保存到后端
        await axios.post('/api/model-config', toSave);

        // 删除数据库中存在但用户 JSON 中不存在的厂商
        const userProviders = new Set(parsed.map(item => item.provider));
        const toDelete = this.fullModelConfigs
          .filter(config => !userProviders.has(config.provider))
          .map(config => config.id);

        if (toDelete.length > 0) {
          await axios.delete('/api/model-config', {
            data: { ids: toDelete }
          });
        }

        // 重新加载配置以获取掩码后的数据
        await this.loadModelsJson();

        // 通知 NoteWall 重新加载模型配置
        if (this.$refs.noteWall && this.$refs.noteWall.loadModelConfig) {
          this.$refs.noteWall.loadModelConfig();
        }

        // 关闭模态框
        this.showEditJsonModal = false;

        alert('模型配置已保存');
      } catch (e) {
        alert('保存失败: ' + (e.response?.data?.error || e.message));
      }
    },

    // 取消编辑 JSON
    cancelEditJson() {
      this.showEditJsonModal = false;
      // 重新加载原来的配置
      this.loadModelsJson();
    },

    // 模型切换事件（来自 NoteWall 的快速选择器）
    onModelChanged(modelData) {
      // 更新当前模型名称（响应式更新）
      this.currentModelName = modelData.model;
      console.log('App.vue: 模型已切换到', modelData.provider, '-', modelData.model);
    },

    // ========== 右侧边栏相关方法 ==========

    // 切换右侧边栏展开/收起
    toggleRightSidebar() {
      this.rightSidebarCollapsed = !this.rightSidebarCollapsed;
    },

    // 搜索输入处理
    onSearchInput() {
      // v-model 自动更新 searchQuery，计算属性 sortedNotes 会自动重新计算
      // 这里可以添加额外的逻辑，比如防抖等
    },

    // 清除搜索
    clearSearch() {
      this.searchQuery = '';
    },

    // 聚焦到全局最新便签（跨所有白板）
    async focusOnLatestNote() {
      let latestNote = null;
      let latestDate = null;

      // 从 allBoardsNotes 中遍历找出全局最新便签
      Object.values(this.allBoardsNotes).forEach(notes => {
        notes.forEach(note => {
          const noteDate = new Date(note.created_at);
          if (!latestDate || noteDate > latestDate) {
            latestDate = noteDate;
            latestNote = note;
          }
        });
      });

      // 如果找到最新便签，执行跨白板跳转
      if (latestNote) {
        await this.jumpToNote(latestNote);
      }
    },

    // 跳转到指定便签（支持跨白板跳转）
    async jumpToNote(note) {
      // 防止并发跳转
      if (this.isJumping) {
        console.warn('[App] 正在跳转中，忽略新的跳转请求');
        return;
      }

      try {
        this.isJumping = true;

        // 尝试从 note 对象获取 board_id 或 wall_id
        let targetBoardId = note.board_id || note.wall_id;

        // 如果没有找到 board_id，尝试从便签列表中查找
        if (!targetBoardId) {
          for (const boardId of Object.keys(this.allBoardsNotes)) {
            const boardNotes = this.allBoardsNotes[boardId] || []; // ✅ 添加空数组保护
            const foundNote = boardNotes.find(noteItem => noteItem.id === note.id); // ✅ 修复变量名
            if (foundNote) {
              const parsedBoardId = parseInt(boardId);
              if (!isNaN(parsedBoardId)) { // ✅ 检查转换是否成功
                targetBoardId = parsedBoardId;
                break;
              }
            }
          }
        }

        // 如果还是没找到，提示错误
        if (!targetBoardId) {
          alert('无法确定便签所属的白板');
          return;
        }

        // 如果便签不在当前白板，先切换到目标白板
        if (targetBoardId !== this.currentBoardId) {
          // 设置初始跳转的便签ID
          this.initialNoteId = note.id;

          // 切换到目标白板（NoteWall 会在 mounted 中自动跳转）
          await this.switchBoard(targetBoardId);

          // 等待 NoteWall 完全加载并跳转完成
          await new Promise(resolve => setTimeout(resolve, 500));

          // 清空初始跳转ID（避免影响后续操作）
          this.initialNoteId = null;
        } else {
          // 当前白板内的跳转，直接调用 NoteWall 的方法
          this.$nextTick(() => {
            if (this.$refs.noteWall && this.$refs.noteWall.jumpToNote) {
              this.$refs.noteWall.jumpToNote(note);
            }
          });
        }
      } finally {
        // 无论成功失败，都重置标志位
        this.isJumping = false;
      }
    },

    // 格式化便签创建时间
    formatNoteTime(createdAt) {
      // 处理 undefined、null 或空字符串的情况
      if (!createdAt) {
        return '刚刚';
      }

      let date;

      // 判断时间格式并正确解析
      // SQLite 返回的时间格式为 "YYYY-MM-DD HH:MM:SS"，这是 UTC 时间
      // 需要将其转换为 ISO 8601 格式（带 Z 后缀）以便 JavaScript 正确解析为 UTC
      if (createdAt.includes(' ')) {
        // 格式: "YYYY-MM-DD HH:MM:SS"
        const utcDateString = createdAt.replace(' ', 'T') + 'Z';
        date = new Date(utcDateString);
      } else if (createdAt.includes('T')) {
        // 已经是 ISO 格式
        date = new Date(createdAt);
      } else {
        // 其他格式，尝试直接解析
        date = new Date(createdAt);
      }

      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        return '刚刚';
      }

      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return '刚刚';
      if (diffMins < 60) return `${diffMins}分钟前`;
      if (diffHours < 24) return `${diffHours}小时前`;
      if (diffDays < 7) return `${diffDays}天前`;

      return date.toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    // ========== 白板右键菜单相关方法 ==========

    // 显示白板右键菜单
    showBoardContextMenu(event, board) {
      this.contextMenuBoard = board;
      this.boardContextMenuPosition = {
        x: event.clientX,
        y: event.clientY
      };
      this.boardContextMenuVisible = true;

      // 点击菜单项后自动关闭菜单
      this.$nextTick(() => {
        const menuItems = document.querySelectorAll('.context-menu-item:not(.disabled)');
        menuItems.forEach(item => {
          item.addEventListener('click', () => {
            this.hideBoardContextMenu();
          }, { once: true });
        });
      });
    },

    // 隐藏白板右键菜单
    hideBoardContextMenu() {
      this.boardContextMenuVisible = false;
      this.contextMenuBoard = null;
    },

    // 编辑白板
    async editBoard(board) {
      // 如果编辑的不是当前白板，先切换过去
      if (board.id !== this.currentBoardId) {
        await this.switchBoard(board.id);
      }

      // 关闭右键菜单
      this.hideBoardContextMenu();

      // 等待组件挂载完成后打开编辑模态框
      this.$nextTick(() => {
        if (this.$refs.noteWall && this.$refs.noteWall.openEditModal) {
          this.$refs.noteWall.openEditModal();
        }
      });
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
  position: fixed;
  left: 247px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 60px;
  background: #2196F3;
  border: 2px solid white;
  border-radius: 0 8px 8px 0;
  cursor: pointer;
  font-size: 16px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2001;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.2);
  transition: left 0.3s ease, all 0.3s ease;
}

.sidebar-toggle.collapsed {
  left: 57px;
}

.sidebar-toggle:hover {
  background: #1976D2;
  width: 36px;
  box-shadow: 3px 0 12px rgba(33, 150, 243, 0.4);
}

.board-list {
  flex: 1;
  overflow-y: auto;
  padding: 60px 16px 10px 16px;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* 隐藏滚动条但保留滚动功能 */
.board-list {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.board-list::-webkit-scrollbar {
  display: none; /* Chrome/Safari/Opera */
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
  opacity: 1;
  max-width: 200px;
  overflow: hidden;
  transition: opacity 0.2s, max-width 0.2s;
  white-space: nowrap;
}

.sidebar.collapsed .add-text {
  opacity: 0;
  max-width: 0;
}

.sidebar.collapsed .add-board-button {
  padding: 12px;
}

.main-content {
  flex: 1;
  height: 100vh;
  overflow: hidden;
  transition: margin-left 0.3s ease, margin-right 0.3s ease;
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
  opacity: 1;
  max-width: 200px;
  overflow: hidden;
  transition: opacity 0.2s, max-width 0.2s;
  white-space: nowrap;
}

.sidebar.collapsed .model-text {
  opacity: 0;
  max-width: 0;
}

.sidebar.collapsed .model-button {
  padding: 12px;
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

/* ========== 右侧边栏样式 ========== */

.right-sidebar {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 300px;
  background: white;
  border-left: 2px solid #e0e0e0;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  z-index: 1500;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
  overflow: hidden;
}

.right-sidebar.collapsed {
  transform: translateX(100%);
}

.right-sidebar-toggle {
  position: fixed;
  right: 297px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 60px;
  background: #2196F3;
  border: 2px solid white;
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  font-size: 16px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1501;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.2);
  transition: right 0.3s ease, all 0.3s ease;
}

.right-sidebar-toggle.collapsed {
  right: -3px;
}

.right-sidebar-toggle:hover {
  background: #1976D2;
  width: 36px;
  box-shadow: -3px 0 12px rgba(33, 150, 243, 0.4);
}

.notes-index {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 15px 16px 16px 16px;
}

.notes-index-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 16px;
}

/* 搜索框样式 */
.search-box {
  position: relative;
  margin-bottom: 16px;
}

.search-input {
  width: 100%;
  padding: 10px 16px;
  padding-right: 36px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  transition: all 0.2s;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: #2196F3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.search-input::placeholder {
  color: #999;
}

.search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border: none;
  background: #ccc;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.search-clear:hover {
  background: #999;
}

.notes-index-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.notes-count {
  background: #2196F3;
  color: white;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

/* 增强搜索开关样式 */
.advanced-search-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
}

input:checked + .slider {
  background-color: #2196F3;
}

input:focus + .slider {
  box-shadow: 0 0 1px #2196F3;
}

input:checked + .slider:before {
  transform: translateX(18px);
}

.slider.round {
  border-radius: 22px;
}

.slider.round:before {
  border-radius: 50%;
}


.notes-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notes-list::-webkit-scrollbar {
  width: 4px;
}

.notes-list::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 2px;
}

.notes-list::-webkit-scrollbar-thumb:hover {
  background: #aaa;
}

.note-index-item {
  padding: 12px 16px;
  background: #f9f9f9;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.note-index-item:hover {
  background: #f0f0f0;
  border-color: #2196F3;
  box-shadow: 0 2px 6px rgba(33, 150, 243, 0.2);
}

.note-index-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-index-time {
  font-size: 12px;
  color: #999;
}

.note-index-board {
  font-size: 11px;
  color: #2196F3;
  background: #e3f2fd;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
}

/* ========== 白板右键菜单样式 ========== */

.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2999;
  background: transparent;
}

.context-menu {
  position: fixed;
  z-index: 3000;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 8px 0;
  min-width: 180px;
  animation: contextMenuFadeIn 0.15s ease-out;
}

@keyframes contextMenuFadeIn {
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
  transition: all 0.15s;
  font-size: 14px;
  color: #333;
  user-select: none;
}

.context-menu-item:hover:not(.disabled) {
  background: #f5f5f5;
  color: #d32f2f;
}

.context-menu-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  color: #999;
}

.menu-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.menu-text {
  flex: 1;
  font-weight: 500;
}

.menu-hint {
  font-size: 11px;
  color: #999;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
}

</style>
