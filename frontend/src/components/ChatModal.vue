<template>
  <Teleport to="body">
    <div v-if="visible" ref="chatModal" class="chat-modal" @keyup.esc="close" @dblclick="close" tabindex="-1">
      <div class="chat-modal-content" @click.stop @wheel.stop @dblclick.stop>
        <!-- 头部 -->
        <div class="chat-header">
          <div class="chat-title">{{ chatTitle }}</div>
          <button class="chat-close-btn" @click="close">×</button>
        </div>

        <!-- 消息列表 -->
        <div class="chat-messages" ref="messagesContainer">
          <div
            v-for="message in messages"
            :key="message.id"
            class="chat-message"
            :class="message.role"
          >
            <div class="message-avatar" @dblclick="onAvatarDblClick(message)" :title="message.role === 'user' ? '双击重新生成回复' : ''">
              {{ message.role === 'user' ? '👤' : '🤖' }}
            </div>
            <div class="message-content">
              <div v-if="message.role === 'user'" class="user-message" @dblclick="startEditUserMessage(message)">
                <!-- 编辑状态 -->
                <input
                  v-if="editingMessageId === message.id"
                  ref="editInput"
                  v-model="editingMessageText"
                  class="user-message-edit-input"
                  @blur="saveUserMessageEdit(message.id)"
                  @keyup.enter="saveUserMessageEdit(message.id)"
                  @keyup.esc="cancelEdit"
                  @click.stop
                />
                <!-- 正常显示状态 -->
                <span v-else>{{ message.title }}</span>
              </div>
              <div v-else class="assistant-message" v-html="renderMarkdown(message.content)" @dblclick="openNoteView(message.id)" :ref="`mermaid-${message.id}`"></div>
            </div>
          </div>
        </div>

        <!-- 导航按钮 -->
        <div class="chat-navigation">
          <div class="nav-counter">
            {{ currentMessageIndex + 1 }}/{{ userMessages.length }}
          </div>
          <button
            class="nav-btn nav-prev"
            @click="navigateToPrev"
            :disabled="isPrevDisabled"
            title="上一条问题"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </button>
          <button
            class="nav-btn nav-next"
            @click="navigateToNext"
            :disabled="isNextDisabled"
            title="下一条问题"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>

        <!-- 输入区域 -->
        <div class="chat-input-area">
          <!-- 模型选择 -->
          <div class="model-selector-container">
            <select v-model="selectedModel" class="model-select" @change="onModelChange">
              <optgroup v-for="provider in availableModels" :key="provider.provider" :label="provider.provider">
                <option
                  v-for="model in provider.models"
                  :key="model"
                  :value="`${provider.provider}|${model}`"
                >
                  {{ model }}
                </option>
              </optgroup>
            </select>
          </div>

          <div class="input-row">
            <input
              v-model="inputMessage"
              type="text"
              class="chat-input"
              placeholder="输入问题继续对话..."
              @keyup.enter="sendMessage"
            />
            <button
              class="chat-send-btn"
              @click="sendMessage"
              :disabled="!inputMessage.trim()"
            >
              发送
            </button>
          </div>

          <div v-if="error" class="chat-error">{{ error }}</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
import axios from 'axios';
import MarkdownIt from 'markdown-it';
import markdownItKatex from '@vscode/markdown-it-katex';
import DOMPurify from 'dompurify';
import mermaid from 'mermaid';
import 'katex/dist/katex.min.css';

// 初始化 mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

// Initialize markdown-it with KaTeX plugin
const md = new MarkdownIt({
  html: true,           // Enable HTML tags in source (safe due to DOMPurify)
  linkify: true,        // Autoconvert URL-like texts to links
  typographer: true,     // Enable some language-neutral replacement + quotes beautification
  breaks: true,         // Convert '\n' to <br>
}).use(markdownItKatex, {
  throwOnError: false,
  errorColor: '#cc0000'
});

export default {
  name: 'ChatModal',
  props: {
    availableModels: {
      type: Array,
      default: () => []
    },
    initialNote: {
      type: Object,
      default: null
    },
    upstreamNotes: {
      type: Array,
      default: () => []
    },
    allNotes: {
      type: Array,
      default: () => []
    },
    contextLevel: {
      type: Number,
      default: 5
    }
  },
  data() {
    return {
      visible: false,
      messages: [],
      inputMessage: '',
      selectedModel: '',
      error: null,
      rootNoteId: null,
      lastNoteId: null,
      lastNotePosition: null,
      newNotesCache: {},  // 缓存新创建的便签（用于保存内容时查找）
      renderedCache: {},   // 缓存已渲染的 HTML
      editingMessageId: null,  // 正在编辑的消息ID
      editingMessageText: '',    // 编辑中的消息文本
      currentMessageIndex: -1,   // 当前所在用户消息索引
      intersectionObserver: null   // Intersection Observer 实例
    };
  },
  computed: {
    chatTitle() {
      if (this.rootNoteId) {
        const rootNote = this.findNoteById(this.rootNoteId);
        return rootNote ? `对话 - ${rootNote.title}` : '对话模式';
      }
      return '对话模式';
    },
    // 用户消息列表（只包含 role 为 'user' 的消息）
    userMessages() {
      return this.messages.filter(m => m.role === 'user');
    },
    // 上一条按钮是否禁用
    isPrevDisabled() {
      return this.currentMessageIndex <= 0;
    },
    // 下一条按钮是否禁用
    isNextDisabled() {
      return this.currentMessageIndex >= this.userMessages.length - 1;
    }
  },
  mounted() {
    // 组件挂载后初始化滚动监听
    this.$nextTick(() => {
      this.initScrollObserver();
    });
  },
  beforeUnmount() {
    // 组件卸载前清理 observer
    this.cleanupScrollObserver();
  },
  methods: {
    // 打开对话模式
    open(noteId, notePosition) {
      this.rootNoteId = noteId;
      this.lastNoteId = noteId;
      this.lastNotePosition = notePosition;
      this.visible = true;
      this.loadMessages();

      // 加载最后使用的模型
      const lastUsedModel = localStorage.getItem('lastUsedModel');
      if (lastUsedModel) {
        this.selectedModel = lastUsedModel;
      } else if (this.availableModels.length > 0 && this.availableModels[0].models.length > 0) {
        this.selectedModel = `${this.availableModels[0].provider}|${this.availableModels[0].models[0]}`;
      }

      // 滚动到最后一条消息的顶部并聚焦模态框
      this.$nextTick(() => {
        this.scrollToLastMessageTop();
        // 初始化当前消息索引到最后一条用户消息
        this.currentMessageIndex = this.userMessages.length - 1;
        // 聚焦模态框，使 ESC 键可以工作
        if (this.$refs.chatModal) {
          this.$refs.chatModal.focus();
        }
      });
    },

    // 关闭对话模式
    close() {
      this.visible = false;
      this.messages = [];
      this.inputMessage = '';
      this.error = null;
      this.rootNoteId = null;
      this.lastNoteId = null;
      this.lastNotePosition = null;
      this.newNotesCache = {};
      this.editingMessageId = null;
      this.editingMessageText = '';
    },

    // 加载消息
    loadMessages() {
      if (!this.rootNoteId) return;

      const messages = [];

      // 添加上游便签（按上游Notes数组的顺序，已经是按创建时间排序的）
      this.upstreamNotes.forEach(note => {
        messages.push({
          id: note.id,
          title: note.title,
          content: note.content,
          role: 'user',
          timestamp: note.created_at
        });

        // 如果有内容，添加AI响应
        if (note.content && note.content.trim()) {
          messages.push({
            id: note.id + '_assistant',
            title: note.title,
            content: note.content,
            role: 'assistant',
            timestamp: note.created_at
          });
        }
      });

      // 添加根便签（用户消息）- 放在最后，确保它是最新的对话点
      const rootNote = this.findNoteById(this.rootNoteId);
      if (rootNote) {
        messages.push({
          id: rootNote.id,
          title: rootNote.title,
          content: rootNote.content,
          role: 'user',
          timestamp: rootNote.created_at
        });

        // 如果有内容，添加AI响应
        if (rootNote.content && rootNote.content.trim()) {
          messages.push({
            id: rootNote.id + '_assistant',
            title: rootNote.title,
            content: rootNote.content,
            role: 'assistant',
            timestamp: rootNote.created_at
          });
        }
      }

      // 不再按创建时间排序，保持对话流的逻辑顺序（上游->根便签）
      this.messages = messages;

      // 在下一个 tick 渲染 mermaid 图表
      this.$nextTick(() => {
        this.renderMermaidDiagrams();
        // 重新初始化滚动监听（消息列表已更新）
        this.initScrollObserver();
      });
    },

    // 查找便签
    findNoteById(noteId) {
      // 先从缓存中查找新创建的便签
      if (this.newNotesCache[noteId]) {
        return this.newNotesCache[noteId];
      }
      // 再从上游便签中查找
      const note = this.upstreamNotes.find(n => n.id === noteId);
      if (note) return note;
      // 从所有便签中查找（获取最新数据）
      const allNote = this.allNotes.find(n => n.id === noteId);
      if (allNote) return allNote;
      // 最后检查根便签
      return this.initialNote && this.initialNote.id === noteId ? this.initialNote : null;
    },

    // 发送消息
    async sendMessage() {
      if (!this.inputMessage.trim()) return;

      const [provider, model] = this.selectedModel.split('|');
      if (!provider || !model) {
        this.error = '请选择模型';
        return;
      }

      // 保存选中的模型到 localStorage
      localStorage.setItem('lastUsedModel', this.selectedModel);

      const title = this.inputMessage.trim();
      this.inputMessage = '';
      this.error = null;

      // 1. 创建新便签
      let newNoteId = null;
      let newPosition = null;

      try {
        // 计算新便签位置（在最后一个便签下方）
        if (this.lastNotePosition) {
          newPosition = {
            x: this.lastNotePosition.x,
            y: this.lastNotePosition.y + 230 // 便签高度 + 间距
          };
        } else {
          // 默认位置
          newPosition = { x: 100, y: 100 };
        // 如果是第一条消息，从根便签的位置开始
          const rootNote = this.findNoteById(this.rootNoteId);
          if (rootNote) {
            newPosition.x = rootNote.position_x || 100;
            newPosition.y = (rootNote.position_y || 100) + 230;
          }
        }

        const createResponse = await axios.post('/api/notes', {
          title: title,
          content: '',
          position_x: newPosition.x,
          position_y: newPosition.y,
          wall_id: this.initialNote?.wall_id || 1
        });

        newNoteId = createResponse.data.note.id;
        this.lastNotePosition = newPosition;

        // 缓存新便签信息，用于后续保存内容时查找
        this.newNotesCache[newNoteId] = {
          id: newNoteId,
          title: title,
          position_x: newPosition.x,
          position_y: newPosition.y,
          content: ''
        };

        // 2. 创建连接（从最后一个便签到新便签，如果没有lastNoteId则从根便签开始）
        // 注意：此时 lastNoteId 还是上一次的，所以要先用它创建连接，然后再更新
        const sourceNoteId = this.lastNoteId || this.rootNoteId;

        // 确保不连接到自己（虽然理论上不会发生，但为了安全）
        if (sourceNoteId !== newNoteId) {
          await axios.post('/api/notes/connections', {
            source_note_id: sourceNoteId,
            target_note_id: newNoteId,
            wall_id: this.initialNote?.wall_id || 1
          });
        }

        // 更新最后一个便签ID
        this.lastNoteId = newNoteId;

        // 3. 添加用户消息到界面
        this.messages.push({
          id: newNoteId,
          title: title,
          content: '',
          role: 'user',
          timestamp: new Date().toISOString()
        });

        // 添加空的 AI 消息占位
        this.messages.push({
          id: `${newNoteId}_assistant`,
          title: '',
          content: '',
          role: 'assistant',
          timestamp: new Date().toISOString()
        });

        // 滚动到底部
        this.$nextTick(() => {
          this.scrollToBottom();
          // 重新初始化滚动监听
          this.initScrollObserver();
        });

        // 4. 触发便签生成事件
        this.$emit('trigger-note-generate', {
          noteId: newNoteId,
          provider,
          model
        });

      } catch (error) {
        console.error('Failed to send message:', error);
        this.error = error.response?.data?.error || error.message || '发送消息失败';

        // 移除刚添加的用户消息
        if (newNoteId) {
          this.messages = this.messages.filter(m => m.id !== newNoteId && m.id !== `${newNoteId}_assistant`);
        }
      }
    },

    // 处理便签的流式内容更新
    onStreamingUpdate({ noteId, content }) {
      // 更新缓存
      if (this.newNotesCache[noteId]) {
        this.newNotesCache[noteId].content = content;
      }

      // 更新消息列表中的 AI 响应
      const targetId = `${noteId}_assistant`;
      const aiMessageIndex = this.messages.findIndex(m => m.id === targetId);

      if (aiMessageIndex !== -1) {
        // 更新现有消息 - 使用重新赋值确保响应式
        this.messages[aiMessageIndex] = {
          ...this.messages[aiMessageIndex],
          content: content
        };
        // 强制触发响应式更新
        this.messages = [...this.messages];
      } else {
        // 添加新的 AI 消息
        this.messages.push({
          id: targetId,
          title: '',
          content: content,
          role: 'assistant',
          timestamp: new Date().toISOString()
        });
      }

      // 在下一个 tick 渲染 mermaid 图表
      this.$nextTick(() => {
        this.renderMermaidDiagrams();
      });
    },

    // 处理便签的标题和内容更新（从 Note.vue 的编辑框同步）
    onNoteUpdate(updatedNote) {
      // 更新缓存
      if (this.newNotesCache[updatedNote.id]) {
        this.newNotesCache[updatedNote.id] = {
          ...this.newNotesCache[updatedNote.id],
          title: updatedNote.title,
          content: updatedNote.content
        };
      }

      // 更新用户消息的标题和内容
      const userMessageIndex = this.messages.findIndex(m => m.id === updatedNote.id);
      if (userMessageIndex !== -1) {
        this.messages[userMessageIndex] = {
          ...this.messages[userMessageIndex],
          title: updatedNote.title,
          content: updatedNote.content
        };
        this.messages = [...this.messages];
      }

      // 更新 AI 响应的内容
      const aiMessageId = `${updatedNote.id}_assistant`;
      const aiMessageIndex = this.messages.findIndex(m => m.id === aiMessageId);
      if (aiMessageIndex !== -1) {
        this.messages[aiMessageIndex] = {
          ...this.messages[aiMessageIndex],
          title: updatedNote.title,
          content: updatedNote.content
        };
        this.messages = [...this.messages];
      }
    },

    // 模型变化
    onModelChange() {
      localStorage.setItem('lastUsedModel', this.selectedModel);
    },

    // 点击遮罩层关闭
    onOverlayClick() {
      this.close();
    },

    // 滚动到底部
    scrollToBottom() {
      const container = this.$refs.messagesContainer;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    },

    // 滚动到最后一条消息的顶部
    scrollToLastMessageTop() {
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer;
        if (container && this.messages.length > 0) {
          // 获取消息元素
          const messageElements = container.querySelectorAll('.chat-message');
          if (messageElements.length > 0) {
            // 消息是成对的（用户消息 + AI回复），找到最后一条用户消息（倒数第二条）
            // 如果只有一条消息，就用最后一条
            const targetIndex = messageElements.length > 1 ? messageElements.length - 2 : 0;
            const targetMessage = messageElements[targetIndex];
            // 使用 scrollIntoView 精确滚动到元素顶部
            targetMessage.scrollIntoView({ behavior: 'auto', block: 'start' });
            // 微调：稍微向上滚动一点，露出边框（容器 padding 为 20px，向上调整 5px）
            container.scrollTop -= 20;
          }
        }
      });
    },

    // 滚动到指定用户消息的顶部
    scrollToMessageTop(userMessageIndex) {
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer;
        if (container && this.messages.length > 0) {
          const messageElements = container.querySelectorAll('.chat-message');
          // 每个用户消息对应的DOM索引 = 用户消息索引 * 2
          const targetDomIndex = userMessageIndex * 2;
          if (targetDomIndex < messageElements.length) {
            const targetMessage = messageElements[targetDomIndex];
            targetMessage.scrollIntoView({ behavior: 'auto', block: 'start' });
            container.scrollTop -= 20; // 补偿容器 padding
            this.currentMessageIndex = userMessageIndex;
          }
        }
      });
    },

    // 跳转到上一条用户消息
    navigateToPrev() {
      if (this.currentMessageIndex > 0) {
        this.scrollToMessageTop(this.currentMessageIndex - 1);
      }
    },

    // 跳转到下一条用户消息
    navigateToNext() {
      if (this.currentMessageIndex < this.userMessages.length - 1) {
        this.scrollToMessageTop(this.currentMessageIndex + 1);
      }
    },

    // 初始化滚动监听
    initScrollObserver() {
      // 清理旧的 observer
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
      }

      // 创建 Intersection Observer
      this.intersectionObserver = new IntersectionObserver((entries) => {
        // 找出所有进入视口的用户消息
        const visibleUserMessages = entries
          .filter(entry => entry.isIntersecting)
          .map(entry => {
            // 从 DOM 元素找到对应的消息索引
            const messageElements = this.$refs.messagesContainer.querySelectorAll('.chat-message');
            return Array.from(messageElements).indexOf(entry.target);
          })
          .filter(index => index !== -1 && index % 2 === 0) // 只取用户消息（偶数索引）
          .map(domIndex => domIndex / 2); // 转换为用户消息索引

        if (visibleUserMessages.length > 0) {
          // 取最接近顶部的可见消息（索引最小的）
          const topmostVisibleIndex = Math.min(...visibleUserMessages);
          if (topmostVisibleIndex !== this.currentMessageIndex) {
            this.currentMessageIndex = topmostVisibleIndex;
          }
        }
      }, {
        // 触发阈值：元素进入视口 10% 时即触发
        threshold: 0.1,
        root: this.$refs.messagesContainer,
        rootMargin: '-60px 0px 0px 0px' // 顶部偏移，忽略头部遮挡区域
      });

      // 观察所有用户消息元素
      this.$nextTick(() => {
        const messageElements = this.$refs.messagesContainer.querySelectorAll('.chat-message.user');
        messageElements.forEach(el => this.intersectionObserver.observe(el));
      });
    },

    // 清理 Observer
    cleanupScrollObserver() {
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
        this.intersectionObserver = null;
      }
    },

    // 打开便签查看状态
    openNoteView(messageId) {
      // 消息ID格式：纯数字为用户便签，数字+'_assistant'为AI响应
      const isAssistant = String(messageId).includes('_assistant');
      const noteId = String(messageId).replace('_assistant', '');
      this.$emit('open-note-view', {
        noteId: parseInt(noteId),
        editTitle: !isAssistant  // 用户消息需要编辑标题，AI响应不需要
      });
    },

    // 开始编辑用户消息
    startEditUserMessage(message) {
      this.editingMessageId = message.id;
      this.editingMessageText = message.title;
      // 聚焦输入框，光标放在末尾
      this.$nextTick(() => {
        if (this.$refs.editInput && this.$refs.editInput.length > 0) {
          this.$refs.editInput[0].focus();
          // 光标移到末尾
          const length = this.editingMessageText.length;
          this.$refs.editInput[0].setSelectionRange(length, length);
        }
      });
    },

    // 保存用户消息编辑
    async saveUserMessageEdit(messageId) {
      if (!this.editingMessageText.trim()) {
        // 如果为空，取消编辑
        this.cancelEdit();
        return;
      }

      const newTitle = this.editingMessageText.trim();
      const oldMessage = this.messages.find(m => m.id === messageId);

      // 获取便签的完整信息（包括位置）
      const note = this.findNoteById(messageId);

      try {
        // 更新数据库中的便签标题
        await axios.put(`/api/notes/${messageId}`, {
          title: newTitle,
          content: oldMessage?.content || '',
          position_x: note?.position_x || 0,
          position_y: note?.position_y || 0
        });

        // 更新本地消息
        const messageIndex = this.messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
          this.messages[messageIndex] = {
            ...this.messages[messageIndex],
            title: newTitle
          };
          this.messages = [...this.messages];
        }

        // 更新缓存中的便签
        if (this.newNotesCache[messageId]) {
          this.newNotesCache[messageId].title = newTitle;
        }

        // 触发便签更新事件，通知父组件
        this.$emit('note-updated', {
          id: messageId,
          title: newTitle,
          content: oldMessage?.content || ''
        });

      } catch (error) {
        console.error('保存消息编辑失败:', error);
        this.error = '保存失败，请重试';
      } finally {
        this.editingMessageId = null;
        this.editingMessageText = '';
      }
    },

    // 取消编辑
    cancelEdit() {
      this.editingMessageId = null;
      this.editingMessageText = '';
    },

    // 双击头像处理
    onAvatarDblClick(message) {
      if (message.role === 'user') {
        // 双击用户头像：重新生成AI内容
        this.regenerateContent(message);
      }
      // AI回复的头像双击暂无操作
    },

    // 重新生成AI内容
    regenerateContent(userMessage) {
      const [provider, model] = this.selectedModel.split('|');
      if (!provider || !model) {
        this.error = '请选择模型';
        return;
      }

      // 保存选中的模型到 localStorage
      localStorage.setItem('lastUsedModel', this.selectedModel);

      const noteId = userMessage.id;

      // 清空现有AI响应内容
      const aiMessageId = `${noteId}_assistant`;
      const aiMessageIndex = this.messages.findIndex(m => m.id === aiMessageId);

      if (aiMessageIndex !== -1) {
        this.messages[aiMessageIndex] = {
          ...this.messages[aiMessageIndex],
          content: ''  // 清空内容，准备接收新的流式响应
        };
        this.messages = [...this.messages];
      }

      // 触发便签生成事件
      this.$emit('trigger-note-generate', {
        noteId: noteId,
        provider,
        model
      });

      // 清除错误提示
      this.error = null;
    },

    // 渲染Markdown（使用 markdown-it + KaTeX 插件）
    renderMarkdown(content) {
      if (!content) return '';

      // 使用缓存的渲染结果（如果存在）
      const cacheKey = content;
      if (this.renderedCache[cacheKey]) {
        return this.renderedCache[cacheKey];
      }

      // 使用 markdown-it 渲染（KaTeX 插件会自动处理数学公式）
      const html = md.render(content);

      // 清理 HTML（防止 XSS 攻击）
      const cleanHtml = DOMPurify.sanitize(html);

      // 缓存结果
      this.renderedCache[cacheKey] = cleanHtml;

      // 在下一个 tick 渲染 mermaid 图表
      this.$nextTick(() => {
        this.renderMermaidDiagrams();
      });

      return cleanHtml;
    },

    // 渲染所有 mermaid 图表
    async renderMermaidDiagrams() {
      // 查找所有 mermaid 代码块
      const mermaidBlocks = document.querySelectorAll('.assistant-message pre code.language-mermaid');

      for (const block of mermaidBlocks) {
        const code = block.textContent;
        const pre = block.parentElement;

        // 跳过已渲染的
        if (pre.getAttribute('data-mermaid-rendered') === 'true') {
          continue;
        }

        try {
          // 生成唯一 ID
          const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // 渲染 mermaid 图表
          const { svg } = await mermaid.render(id, code);

          // 替换 pre 元素为 SVG
          pre.outerHTML = `<div class="mermaid-diagram">${svg}</div>`;

        } catch (error) {
          console.error('Mermaid render error:', error);
          // 保持原始代码块显示错误
          pre.outerHTML = `<div class="mermaid-error"><pre><code>${block.textContent}</code></pre><p class="error-text">图表渲染失败</p></div>`;
        }
      }
    },
  }
};
</script>

<style scoped>
.chat-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
}

.chat-modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  width: 90%;
  height: 95vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: chatModalAppear 0.2s ease-out;
}

@keyframes chatModalAppear {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 头部 */
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  background: #f5f5f5;
}

.chat-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.chat-close-btn {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #999;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.chat-close-btn:hover {
  background: #e0e0e0;
  color: #333;
}

/* 消息列表 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #fafafa;
  position: relative; /* 为导航按钮定位 */
}

.chat-message {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  animation: messageAppear 0.3s ease-out;
}

@keyframes messageAppear {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s;
}

.message-avatar:hover {
  background: #d0d0d0;
  transform: scale(1.1);
}

.message-content {
  flex: 1;
  min-width: 0;
}

.user-message {
  background: #2196f3;
  color: white;
  padding: 12px 16px;
  border-radius: 8px 8px 8px 2px;
  display: inline-block;
  max-width: 100%;
  word-wrap: break-word;
  line-height: 1.5;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 18px;
}

/* 编辑状态下使用最大宽度 */
.user-message:has(.user-message-edit-input) {
  display: block;
  width: 100%;
  box-sizing: border-box;
}

.user-message:hover {
  background: #1976d2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.user-message-edit-input {
  background: white;
  color: #333;
  padding: 12px 16px;
  border-radius: 8px 8px 2px 8px;
  border: 2px solid #2196f3;
  outline: none;
  font-size: 18px;
  width: 100%;
  min-width: 200px;
  box-sizing: border-box;
  cursor: text;
}

.user-message-edit-input:focus {
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.3);
}

.assistant-message {
  background: white;
  color: #333;
  padding: 12px 16px;
  border-radius: 2px 8px 8px 8px;
  display: inline-block;
  max-width: 100%;
  word-wrap: break-word;
  line-height: 1.6;
  border: 1px solid #e0e0e0;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 18px;
}

.assistant-message:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: #2196f3;
}

/* 输入区域 */
.chat-input-area {
  padding: 16px 20px;
  border-top: 1px solid #e0e0e0;
  background: white;
}

.model-selector-container {
  margin-bottom: 12px;
}

.model-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.model-select:focus {
  outline: none;
  border-color: #2196f3;
}

.input-row {
  display: flex;
  gap: 10px;
}

.chat-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.chat-input:focus {
  border-color: #2196f3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.chat-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.chat-send-btn {
  padding: 12px 24px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: background 0.2s;
}

.chat-send-btn:hover:not(:disabled) {
  background: #1976d2;
}

.chat-send-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.chat-error {
  margin-top: 8px;
  padding: 8px 12px;
  background: #ffebee;
  color: #f44336;
  border-radius: 4px;
  font-size: 14px;
}

/* Vditor 渲染样式覆盖 */
.assistant-message :deep(.vditor-reset) {
  padding: 0;
  background: transparent;
}

/* KaTeX 数学公式样式 */
.assistant-message :deep(.katex) {
  font-size: 1.05em;
  font-family: 'KaTeX_Main', 'Times New Roman', Times, serif;
  font-weight: 400;
}

.assistant-message :deep(.katex .katex-html) {
  color: #000;
}

.assistant-message :deep(.katex-display) {
  display: block;
  margin: 1em 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.assistant-message :deep(h1),
.assistant-message :deep(h2),
.assistant-message :deep(h3),
.assistant-message :deep(h4),
.assistant-message :deep(h5),
.assistant-message :deep(h6) {
  margin: 16px 0 8px 0;
  font-weight: 600;
  color: #333;
}

.assistant-message :deep(h1) {
  font-size: 34px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 4px;
  margin-top: 24px;
  line-height: 1.3;
}

.assistant-message :deep(h2) {
  font-size: 30px;
  margin-top: 20px;
  line-height: 1.3;
}

.assistant-message :deep(h3) {
  font-size: 26px;
  margin-top: 16px;
  line-height: 1.4;
}

.assistant-message :deep(h4) {
  font-size: 22px;
  margin-top: 14px;
  line-height: 1.4;
}

.assistant-message :deep(h5) {
  font-size: 19px;
  margin-top: 12px;
  line-height: 1.4;
}

.assistant-message :deep(h6) {
  font-size: 17px;
  margin-top: 12px;
  line-height: 1.4;
}

.assistant-message :deep(p) {
  margin: 8px 0;
  line-height: 1.6;
}

.assistant-message :deep(ul),
.assistant-message :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.assistant-message :deep(li) {
  margin: 4px 0;
}

.assistant-message :deep(blockquote) {
  margin: 8px 0;
  padding: 8px 12px;
  border-left: 3px solid #2196f3;
  background: #f5f5f5;
  color: #555;
}

.assistant-message :deep(pre) {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 8px 0;
  border: 1px solid #e0e0e0;
}

.assistant-message :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 14px;
}

.assistant-message :deep(code) {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  color: #e83e8c;
}

.assistant-message :deep(strong) {
  font-weight: bold;
}

.assistant-message :deep(em) {
  font-style: italic;
}

.assistant-message :deep(a) {
  color: #2196f3;
  text-decoration: underline;
}

.assistant-message :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
}

.assistant-message :deep(table th),
.assistant-message :deep(table td) {
  border: 1px solid #e0e0e0;
  padding: 8px 12px;
  text-align: left;
}

.assistant-message :deep(table th) {
  background: #f5f5f5;
  font-weight: 600;
}

.assistant-message :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.assistant-message :deep(hr) {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 16px 0;
}

/* Mermaid 图表样式 */
.assistant-message :deep(.mermaid-diagram) {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 16px 0;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.assistant-message :deep(.mermaid-diagram svg) {
  max-width: 100%;
  height: auto;
}

.assistant-message :deep(.mermaid-error) {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  padding: 12px;
  margin: 8px 0;
}

.assistant-message :deep(.mermaid-error .error-text) {
  color: #856404;
  margin: 8px 0 0 0;
  font-size: 14px;
}

/* 消息导航按钮 */
.chat-navigation {
  position: absolute;
  right: 30px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 10;
  pointer-events: none; /* 让容器不阻挡鼠标事件 */
}

.nav-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(33, 150, 243, 0.2);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5) inset;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  color: #2196f3;
  pointer-events: auto; /* 恢复按钮的鼠标事件 */
  user-select: none;
  padding: 0;
}

.nav-btn svg {
  width: 20px;
  height: 20px;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.nav-counter {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(33, 150, 243, 0.15);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  color: #2196f3;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.5) inset;
  pointer-events: auto;
  user-select: none;
  min-width: 40px;
  text-align: center;
}

.nav-btn:hover:not(:disabled) {
  background: #2196f3;
  color: white;
  transform: scale(1.08);
  box-shadow: 0 4px 16px rgba(33, 150, 243, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.2) inset;
  border-color: transparent;
}

.nav-btn:active:not(:disabled) {
  transform: scale(0.98);
  transition: transform 0.1s;
}

.nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  background: rgba(245, 245, 245, 0.9);
  border-color: rgba(0, 0, 0, 0.08);
  color: #aaa;
  box-shadow: none;
}
</style>
