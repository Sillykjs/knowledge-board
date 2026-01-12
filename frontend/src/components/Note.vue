<template>
  <div
    class="note"
    :data-note-id="id"
    :style="{ left: position_x + 'px', top: position_y + 'px' }"
    @contextmenu.prevent="onContextMenu"
    @mousedown="onMouseDown"
  >
    <!-- 引入点（上中心） -->
    <div
      class="connection-point input-point"
      @mousedown.stop="onInputPointMouseDown"
      @dblclick.stop="onInputPointDoubleClick"
      title="引入连接（双击编辑便签）"
    >
      <div class="point-inner"></div>
    </div>

    <div class="note-content" @dblclick="openViewModal">
      <h3 class="note-title">{{ title }}</h3>
      <p class="note-text">{{ truncatedContent }}</p>
    </div>

    <!-- 引出点（下中心） -->
    <div
      class="connection-point output-point"
      @mousedown.stop="onOutputPointMouseDown"
      @dblclick.stop="onOutputPointDoubleClick"
      title="引出连接（双击在下方创建新便签）"
    >
      <div class="point-inner"></div>
    </div>

    <!-- 右键菜单 - 使用 Teleport 传送到 body，避免受 wall-content 缩放影响 -->
    <Teleport to="body">
      <div
        v-if="showContextMenu"
        class="context-menu"
        :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
        @wheel.stop
      >
        <div class="context-menu-item danger" @click="deleteNote">
          <span class="menu-icon">🗑️</span>
          <span>删除</span>
        </div>
      </div>
    </Teleport>


    <!-- 查看模态框 (只读模式) - 使用 Teleport 传送到 body，避免受 wall-content 缩放影响 -->
    <Teleport to="body">
      <div v-if="showViewModal" class="view-modal" @click="closeViewModal">
        <div class="view-modal-content" @click.stop @wheel.stop>
          <div class="view-header">
            <div v-if="!editingViewTitle" class="view-title" @dblclick="startEditViewTitle">{{ title }}</div>
            <input
              v-else
              ref="viewTitleInput"
              v-model="viewEditTitle"
              class="view-title-input"
              @blur="saveViewTitle"
              @keyup.enter="saveViewTitle"
              @keyup.esc="cancelEditViewTitle"
            />
            <button class="close-btn" @click="closeViewModal">×</button>
          </div>
          <div class="view-body">
            <div
              v-if="!editingViewContent"
              class="view-content markdown-body"
              v-html="renderedContent"
              @dblclick="startEditViewContent"
            ></div>
            <textarea
              v-else
              ref="viewContentInput"
              v-model="viewEditContent"
              class="view-content-input"
              @blur="saveViewContent"
              @keyup.esc="cancelEditViewContent"
            ></textarea>
          </div>
          <div class="view-footer">
            <button class="btn-ai-generate" @click="generateAIContent">
              <span class="ai-icon">🤖</span>
              <span>AI 生成内容</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import axios from 'axios';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

// 初始化 markdown-it 实例
const md = new MarkdownIt({
  html: false,        // 禁用 HTML 标签（安全考虑）
  linkify: true,      // 自动转换 URL 为链接
  typographer: true,  // 启用美化排版
  breaks: true,       // 转换换行符为 <br>
});

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
      showViewModal: false,
      dragOffsetX: 0,
      dragOffsetY: 0,
      showContextMenu: false,
      contextMenuX: 0,
      contextMenuY: 0,
      isConnecting: false,  // 是否正在创建连接
      editingViewTitle: false,  // 是否正在编辑查看模态框中的标题
      viewEditTitle: this.title,  // 查看模态框中编辑的临时标题
      editingViewContent: false,  // 是否正在编辑查看模态框中的内容
      viewEditContent: this.content  // 查看模态框中编辑的临时内容
    };
  },
  computed: {
    truncatedContent() {
      return this.content || '';
    },
    // 渲染 Markdown 内容
    renderedContent() {
      if (!this.content) return '';
      try {
        // 1. 使用 markdown-it 解析 markdown
        const renderedMarkdown = md.render(this.content);
        // 2. 使用 DOMPurify 净化 HTML（防止 XSS）
        const cleanHtml = DOMPurify.sanitize(renderedMarkdown, {
          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
                         'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                         'ul', 'ol', 'li', 'blockquote', 'a', 'hr',
                         'table', 'thead', 'tbody', 'tr', 'th', 'td'],
          ALLOWED_ATTR: ['href', 'title', 'class', 'target'],
          ALLOW_DATA_ATTR: false
        });
        return cleanHtml;
      } catch (error) {
        console.error('Markdown rendering error:', error);
        // 出错时返回纯文本
        return this.content;
      }
    }
  },
  methods: {
    // 引出点鼠标按下事件
    onOutputPointMouseDown(event) {
      this.isConnecting = true;  // 标记正在连接
      // 添加全局 mouseup 监听器，用于重置连接状态
      document.addEventListener('mouseup', this.resetConnectingState);
      this.$emit('connection-start', {
        noteId: this.id,
        type: 'output',
        event
      });
    },

    // 引出点双击事件 - 在正下方创建新便签并连接
    onOutputPointDoubleClick(event) {
      this.$emit('quick-create', {
        noteId: this.id,
        event
      });
    },

    // 引入点鼠标按下事件
    onInputPointMouseDown(event) {
      this.isConnecting = true;  // 标记正在连接
      // 添加全局 mouseup 监听器，用于重置连接状态
      document.addEventListener('mouseup', this.resetConnectingState);
      this.$emit('connection-start', {
        noteId: this.id,
        type: 'input',
        event
      });
    },

    // 引入点双击事件 - 打开查看模态框并编辑内容
    onInputPointDoubleClick(event) {
      this.openViewModal();
      this.$nextTick(() => {
        this.startEditViewContent();
      });
    },

    // 重置连接状态
    resetConnectingState() {
      this.isConnecting = false;
      document.removeEventListener('mouseup', this.resetConnectingState);
    },

    openViewModal() {
      this.showContextMenu = false;
      this.showViewModal = true;
    },
    closeViewModal() {
      this.showViewModal = false;
      this.editingViewTitle = false;
    },
    startEditViewTitle() {
      this.viewEditTitle = this.title;
      this.editingViewTitle = true;
      this.$nextTick(() => {
        if (this.$refs.viewTitleInput) {
          this.$refs.viewTitleInput.focus();
          this.$refs.viewTitleInput.select();
        }
      });
    },
    async saveViewTitle() {
      if (!this.editingViewTitle) return;
      this.editingViewTitle = false;

      // 如果标题没有变化，直接返回
      if (this.viewEditTitle === this.title) return;

      try {
        await axios.put(`/api/notes/${this.id}`, {
          title: this.viewEditTitle,
          content: this.content,
          position_x: this.position_x,
          position_y: this.position_y
        });

        this.$emit('update', {
          id: this.id,
          title: this.viewEditTitle,
          content: this.content,
          position_x: this.position_x,
          position_y: this.position_y
        });
      } catch (error) {
        console.error('Failed to update note title:', error);
      }
    },
    cancelEditViewTitle() {
      this.editingViewTitle = false;
      this.viewEditTitle = this.title;
    },
    startEditViewContent() {
      this.viewEditContent = this.content;
      this.editingViewContent = true;
      this.$nextTick(() => {
        if (this.$refs.viewContentInput) {
          this.$refs.viewContentInput.focus();
        }
      });
    },
    async saveViewContent() {
      if (!this.editingViewContent) return;
      this.editingViewContent = false;

      // 如果内容没有变化，直接返回
      if (this.viewEditContent === this.content) return;

      try {
        await axios.put(`/api/notes/${this.id}`, {
          title: this.title,
          content: this.viewEditContent,
          position_x: this.position_x,
          position_y: this.position_y
        });

        this.$emit('update', {
          id: this.id,
          title: this.title,
          content: this.viewEditContent,
          position_x: this.position_x,
          position_y: this.position_y
        });
      } catch (error) {
        console.error('Failed to update note content:', error);
      }
    },
    cancelEditViewContent() {
      this.editingViewContent = false;
      this.viewEditContent = this.content;
    },
    onMouseDown(e) {
      // 如果查看模态框打开，或正在创建连接，则不处理拖拽
      if (this.showViewModal || this.isConnecting) {
        return;
      }

      // 如果点击的是连接点，不处理拖拽
      if (e.target.classList.contains('connection-point') || e.target.classList.contains('point-inner')) {
        return;
      }

      this.showContextMenu = false;

      // 记录拖拽偏移量
      const rect = this.$el.getBoundingClientRect();
      this.dragOffsetX = e.clientX - rect.left;
      this.dragOffsetY = e.clientY - rect.top;

      // 通知父组件开始拖拽
      this.$emit('drag-start', {
        noteId: this.id,
        offsetX: this.dragOffsetX,
        offsetY: this.dragOffsetY
      });
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
        // 直接使用传入的坐标，允许负值（无限白板）
        await axios.put(`/api/notes/${this.id}`, {
          title: this.title,
          content: this.content,
          position_x: x,
          position_y: y
        });

        this.$emit('update', {
          id: this.id,
          title: this.title,
          content: this.content,
          position_x: x,
          position_y: y
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
    async generateAIContent() {
      // TODO: 调用后端 API，传递便签标题
      // 目前先返回固定文本
      const generatedContent = `根据标题「${this.title}」生成的 AI 内容：\n\n这是一个示例回复。后续将接入真实的大模型 API。`;

      try {
        // 更新到数据库
        await axios.put(`/api/notes/${this.id}`, {
          title: this.title,
          content: generatedContent,
          position_x: this.position_x,
          position_y: this.position_y
        });

        // 更新本地数据（触发父组件更新）
        this.$emit('update', {
          id: this.id,
          title: this.title,
          content: generatedContent,
          position_x: this.position_x,
          position_y: this.position_y
        });
      } catch (error) {
        console.error('Failed to generate AI content:', error);
      }
    }

  },
  mounted() {
    document.addEventListener('click', this.closeContextMenuOnOutsideClick);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.closeContextMenuOnOutsideClick);
  }
};
</script>

<style scoped>
.note {
  position: absolute;
  width: 250px;
  height: 180px;
  background: #e3f2fd;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 16px;
  cursor: move;
  user-select: none;
  transition: box-shadow 0.2s;
  /* overflow: hidden; */
  /* 优化缩放时的文字渲染质量 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transform-style: preserve-3d;
  backface-visibility: hidden;
}

.note:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

/* 连接点样式 */
.connection-point {
  position: absolute;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #2196f3;
  cursor: crosshair;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 10;
  opacity: 0;
  pointer-events: none;
}

.note:hover .connection-point {
  opacity: 1;
  pointer-events: auto;
}

.connection-point:hover {
  transform: translateX(-50%) scale(1.3);
  background: #2196f3;
  box-shadow: 0 0 8px rgba(33, 150, 243, 0.5);
}

.point-inner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2196f3;
}

.input-point {
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
}

.output-point {
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
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
  overflow: hidden;
  max-height: 84px;
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

/* 查看模态框样式 */
.view-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2001;
}

.view-modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 800px;
  height: 800px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: modalAppear 0.2s ease-out;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 8px;
  border-bottom: 1px solid #eee;
}

.view-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.view-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.view-title {
  font-size: 30px;
  font-weight: bold;
  color: #1565c0;
  margin-bottom: 0px;
  line-height: 1.5;
  word-wrap: break-word;
  white-space: pre-wrap;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
  padding: 4px 8px;
  border-radius: 4px;
  margin: -4px -8px;
}

.view-title:hover {
  background: rgba(33, 150, 243, 0.08);
}

.view-title-input {
  font-size: 30px;
  font-weight: bold;
  color: #1565c0;
  line-height: 1.5;
  border: 2px solid #2196f3;
  border-radius: 4px;
  padding: 4px 8px;
  outline: none;
  background: white;
  width: 100%;
  box-sizing: border-box;
}

.view-title-input:focus {
  border-color: #0d47a1;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.edit-body {
  padding: 16px 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.view-content {
  font-size: 19px;
  color: #555;
  word-wrap: break-word;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
  padding: 4px 8px;
  border-radius: 4px;
  margin: -4px -8px;
  height: 100%;
}

/* .view-content:hover {
  background: rgba(33, 150, 243, 0.08);
} */

.view-content-input {
  font-size: 19px;
  color: #555;
  line-height: 1.6;
  border: 2px solid #2196f3;
  border-radius: 4px;
  padding: 8px 12px;
  outline: none;
  background: white;
  width: 100%;
  box-sizing: border-box;
  min-height: 200px;
  resize: vertical;
  font-family: inherit;
  height: 100%;
}

.view-content-input:focus {
  border-color: #0d47a1;
}

/* 非 markdown 模式时的样式 */
.view-content:not(.markdown-body) {
  line-height: 1.6;
  white-space: pre-wrap;
}

/* 查看模态框 Footer */
.view-footer {
  display: flex;
  justify-content: flex-start;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #eee;
}

.btn-ai-generate {
  padding: 8px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-ai-generate:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-ai-generate:active {
  transform: translateY(0);
}

.ai-icon {
  font-size: 16px;
}
</style>

<style>
/* Markdown 样式 - 非scoped以支持v-html渲染 */
.markdown-body {
  line-height: 1.4;
  font-size: 14px;
}

/* 标题样式 */
.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin-top: 12px;
  margin-bottom: 6px;
  font-weight: 600;
  line-height: 1.25;
  color: #333;
}

.markdown-body h1 {
  font-size: 2em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.2em;
}

.markdown-body h2 {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.2em;
}

.markdown-body h3 {
  font-size: 1.25em;
}

/* 段落样式 */
.markdown-body p {
  margin-top: 0;
  margin-bottom: 6px;
}

/* 列表样式 */
.markdown-body ul,
.markdown-body ol {
  padding-left: 2em;
  margin-top: 0;
  margin-bottom: 0;
}

.markdown-body li {
  margin-top: 0;
  margin-bottom: 0;
}

.markdown-body li > p {
  margin-top: 0;
  margin-bottom: 0;
}

/* 代码块样式 */
.markdown-body code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(27, 31, 35, 0.05);
  border-radius: 3px;
  font-family: 'Courier New', Courier, monospace;
}

.markdown-body pre {
  padding: 12px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 6px;
  margin-top: 6px;
  margin-bottom: 6px;
}

.markdown-body pre code {
  padding: 0;
  background-color: transparent;
  font-size: 100%;
}

/* 引用样式 */
.markdown-body blockquote {
  padding: 0 1em;
  color: #6a737d;
  border-left: 0.25em solid #dfe2e5;
  margin: 6px 0;
}

.markdown-body blockquote > :first-child {
  margin-top: 0;
}

.markdown-body blockquote > :last-child {
  margin-bottom: 0;
}

/* 水平线样式 */
.markdown-body hr {
  height: 0.25em;
  padding: 0;
  margin: 12px 0;
  background-color: #e1e4e8;
  border: 0;
}

/* 链接样式 */
.markdown-body a {
  color: #0366d6;
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

/* 表格样式 */
.markdown-body table {
  border-spacing: 0;
  border-collapse: collapse;
  margin-top: 6px;
  margin-bottom: 6px;
  width: 100%;
}

.markdown-body table th,
.markdown-body table td {
  padding: 6px 13px;
  border: 1px solid #dfe2e5;
}

.markdown-body table th {
  font-weight: 600;
  background-color: #f6f8fa;
}

.markdown-body table tr {
  background-color: #fff;
  border-top: 1px solid #c6cbd1;
}

.markdown-body table tr:nth-child(2n) {
  background-color: #f6f8fa;
}

/* 强调样式 */
.markdown-body strong {
  font-weight: 600;
  color: #24292e;
}

.markdown-body em {
  font-style: italic;
}

/* 删除线样式 */
.markdown-body s {
  text-decoration: line-through;
  color: #6a737d;
}
</style>
