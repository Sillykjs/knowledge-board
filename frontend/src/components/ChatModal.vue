<template>
  <Teleport to="body">
    <div v-if="visible" class="chat-modal" @click="onOverlayClick">
      <div class="chat-modal-content" @click.stop @wheel.stop>
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
            <div class="message-avatar">
              {{ message.role === 'user' ? '👤' : '🤖' }}
            </div>
            <div class="message-content">
              <div v-if="message.role === 'user'" class="user-message" @dblclick="openNoteView(message.id)">
                {{ message.title }}
              </div>
              <div v-else class="assistant-message" v-html="renderMarkdown(message.content)" @dblclick="openNoteView(message.id)"></div>
            </div>
          </div>
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
import 'katex/dist/katex.min.css';

// Initialize markdown-it with KaTeX plugin
const md = new MarkdownIt({
  html: false,          // Disable HTML tags in source
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
      renderedCache: {}    // 缓存已渲染的 HTML
    };
  },
  computed: {
    chatTitle() {
      if (this.rootNoteId) {
        const rootNote = this.findNoteById(this.rootNoteId);
        return rootNote ? `对话 - ${rootNote.title}` : '对话模式';
      }
      return '对话模式';
    }
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

      // 滚动到底部
      this.$nextTick(() => {
        this.scrollToBottom();
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
      const aiMessageIndex = this.messages.findIndex(
        m => m.id === `${noteId}_assistant`
      );

      if (aiMessageIndex !== -1) {
        // 更新现有消息
        this.messages[aiMessageIndex].content = content;
      } else {
        // 添加新的 AI 消息
        this.messages.push({
          id: `${noteId}_assistant`,
          title: '',
          content: content,
          role: 'assistant',
          timestamp: new Date().toISOString()
        });
      }

      // 滚动到底部
      this.$nextTick(() => {
        this.scrollToBottom();
      });
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

      return cleanHtml;
    }
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
}

.chat-message {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  animation: messageAppear 0.3s ease-out;
}

/* 用户消息右对齐 */
.chat-message.user {
  flex-direction: row-reverse;
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
}

.message-content {
  flex: 1;
  min-width: 0;
}

/* 用户消息内容右对齐 */
.chat-message.user .message-content {
  display: flex;
  justify-content: flex-end;
}

.user-message {
  background: #2196f3;
  color: white;
  padding: 12px 16px;
  border-radius: 8px 8px 2px 8px;
  display: inline-block;
  max-width: 100%;
  word: break-word;
  overflow-wrap: break-word;
  line-height: 1.5;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 18px;
}

.user-message:hover {
  background: #1976d2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.assistant-message {
  background: white;
  color: #333;
  padding: 12px 16px;
  border-radius: 2px 8px 8px 8px;
  display: inline-block;
  max-width: 100%;
  word: break-word;
  overflow-wrap: break-word;
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
  font-size: 20px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 4px;
}

.assistant-message :deep(h2) {
  font-size: 18px;
}

.assistant-message :deep(h3) {
  font-size: 16px;
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
</style>
