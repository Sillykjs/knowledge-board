<template>
  <div
    class="note"
    :class="{
      generating: isAIGenerating,
      'highlight-flash': isHighlighting,
      selected: isSelected
    }"
    :data-note-id="id"
    :style="{ left: position_x + 'px', top: position_y + 'px' }"
    @contextmenu.prevent="onContextMenu"
    @mousedown="onMouseDown"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <!-- 引入点（上中心） -->
    <div
      class="connection-point input-point"
      @mousedown.stop="onInputPointMouseDown"
      @dblclick.stop="onInputPointDoubleClick"
      title="引入连接（双击编辑标题）"
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
        <div
          class="context-menu-item has-submenu"
          @mouseenter="onModelMenuItemEnter"
          @mouseleave="onModelMenuItemLeave"
        >
          <span class="menu-icon">🤖</span>
          <span>切换模型回答</span>
          <span class="submenu-arrow">▶</span>
        </div>
        <div class="context-menu-item" @click="duplicateNote">
          <span class="menu-icon">📄</span>
          <span>拷贝</span>
        </div>
        <div class="context-menu-item" @click="copyNote">
          <span class="menu-icon">📋</span>
          <span>复制</span>
        </div>
        <div class="context-menu-item" @click="cutNote">
          <span class="menu-icon">✂️</span>
          <span>剪切</span>
        </div>
        <div class="context-menu-item" @click="traceParentNotes">
          <span class="menu-icon">🔗</span>
          <span>上文追溯</span>
        </div>
        <div class="context-menu-item danger" @click="deleteNote">
          <span class="menu-icon">🗑️</span>
          <span>删除</span>
        </div>

        <!-- 模型选择侧边栏 -->
        <transition name="slide-fade">
          <div
            v-if="showModelSelector"
            class="model-selector-sidebar"
            :style="getModelSidebarStyle()"
            @mouseenter="onModelSidebarEnter"
            @mouseleave="onModelSidebarLeave"
          >
            <div class="model-selector-header">
              <span>选择模型重新生成</span>
            </div>
            <div class="model-selector-body">
              <div
                v-for="provider in availableModels"
                :key="provider.provider"
                class="model-provider-group"
              >
                <div class="provider-name">{{ provider.provider }}</div>
                <div
                  v-for="model in provider.models"
                  :key="model"
                  class="model-item"
                  @click="duplicateWithModel(provider.provider, model)"
                >
                  <span class="model-icon">🤖</span>
                  <span class="model-name">{{ model }}</span>
                </div>
              </div>
              <div v-if="!availableModels || availableModels.length === 0" class="no-models">
                暂无可用模型，请先配置模型
              </div>
            </div>
          </div>
        </transition>
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
            <!-- 使用 VditorEditor 替换旧的查看/编辑内容区域 -->
            <VditorEditor
              ref="vditorEditor"
              v-model="viewEditContent"
              :note-id="id"
              :is-generating="isAIGenerating"
              placeholder="开始编辑或生成内容..."
              @blur="saveViewContent"
            />
          </div>
          <div class="view-footer">
            <button class="btn-ai-generate" @click="generateAIContent" :disabled="isAIGenerating">
              <span class="ai-icon">{{ isAIGenerating ? '⏳' : '🤖' }}</span>
              <span>{{ isAIGenerating ? '生成中...' : `${currentModelName} 生成内容` }}</span>
            </button>
            <div v-if="aiError" class="ai-error">{{ aiError }}</div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import axios from 'axios';
import VditorEditor from './VditorEditor.vue';

export default {
  name: 'Note',
  components: {
    VditorEditor
  },
  props: {
    id: Number,
    title: String,
    content: String,
    position_x: Number,
    position_y: Number,
    wallId: {
      type: Number,
      default: 1
    },
    isHighlighting: {
      type: Boolean,
      default: false
    },
    isSelected: {
      type: Boolean,
      default: false
    },
    contextLevel: {
      type: Number,
      default: 1
    },
    currentModelName: {
      type: String,
      default: 'AI'
    },
    availableModels: {
      type: Array,
      default: () => []
    }
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
      viewEditContent: this.content,  // 查看模态框中的内容（v-model 绑定）
      isAIGenerating: false,  // AI生成中
      aiError: null,  // AI错误信息
      streamingContent: '',  // AI流式生成过程中的原始内容累积
      showModelSelector: false,  // 是否显示模型选择侧边栏
      modelSelectorTimer: null  // 侧边栏隐藏定时器
    };
  },
  computed: {
    truncatedContent() {
      return this.content || '';
    }
  },
  watch: {
    // 监听 content prop 的变化，实时同步到查看模态框
    content(newContent) {
      // 如果模态框打开且正在生成内容，实时同步到 Vditor
      if (this.showViewModal && this.isAIGenerating) {
        this.viewEditContent = newContent;
        // 也更新 Vditor 实例
        if (this.$refs.vditorEditor && this.$refs.vditorEditor.vditorInstance) {
          this.$refs.vditorEditor.setValue(newContent);
        }
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

    // 引入点双击事件 - 打开查看模态框并编辑标题
    onInputPointDoubleClick(event) {
      this.openViewModal();
      this.$nextTick(() => {
        this.startEditViewTitle();
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

      // 同步最新的内容到编辑器
      this.viewEditContent = this.content;

      // 确保 Vditor 实例准备好后再设置内容
      this.$nextTick(() => {
        if (this.$refs.vditorEditor && this.$refs.vditorEditor.vditorInstance) {
          this.$refs.vditorEditor.setValue(this.content);
          // 如果正在生成，滚动到底部
          if (this.isAIGenerating) {
            const vditor = this.$refs.vditorEditor.vditorInstance;
            if (vditor && vditor.vditor && vditor.vditor.ir) {
              const irElement = vditor.vditor.ir.element;
              irElement.scrollTop = irElement.scrollHeight;
            }
          }
        }
      });

      // 检查是否为新便签，如果是则自动进入标题编辑状态
      const isNewNote = this.title === '新便签';
      if (isNewNote) {
        this.$nextTick(() => {
          this.startEditViewTitle();
        });
      }
    },

    closeViewModal() {
      // 立即保存内容（不等待 blur 事件）
      this.saveViewContent();
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

      // 检查标题是否为空，如果为空则恢复原标题并取消编辑
      if (!this.viewEditTitle || this.viewEditTitle.trim() === '') {
        this.viewEditTitle = this.title;
        this.editingViewTitle = false;
        return;
      }

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

    async saveViewContent() {
      // 尝试从 VditorEditor 获取最新内容
      let latestContent = this.viewEditContent;

      // 如果 VditorEditor 组件存在且有 getValue 方法，直接获取最新值
      if (this.$refs.vditorEditor && typeof this.$refs.vditorEditor.getValue === 'function') {
        latestContent = this.$refs.vditorEditor.getValue();
        // 更新本地状态
        this.viewEditContent = latestContent;
      }

      // 如果内容没有变化，直接返回
      if (latestContent === this.content) {
        console.log('[Note] 内容未变化，跳过保存');
        return;
      }

      console.log('[Note] 保存内容:', {
        noteId: this.id,
        oldLength: this.content?.length,
        newLength: latestContent?.length,
        changed: latestContent !== this.content
      });

      try {
        await axios.put(`/api/notes/${this.id}`, {
          title: this.title,
          content: latestContent,
          position_x: this.position_x,
          position_y: this.position_y
        });

        this.$emit('update', {
          id: this.id,
          title: this.title,
          content: latestContent,
          position_x: this.position_x,
          position_y: this.position_y
        });

        console.log('[Note] 内容保存成功');
      } catch (error) {
        console.error('[Note] 保存内容失败:', error);
      }
    },
    onMouseDown(e) {
      // 只允许左键（button === 0）拖动便签，中键和右键不触发拖动
      if (e.button !== 0) {
        return;
      }

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
    // 鼠标进入便签
    onMouseEnter() {
      this.$emit('mouse-enter', this.id);
    },
    // 鼠标离开便签
    onMouseLeave() {
      this.$emit('mouse-leave', this.id);
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
    cutNote() {
      this.showContextMenu = false;

      // 触发剪切事件，传递便签信息给父组件
      this.$emit('cut', {
        id: this.id,
        title: this.title,
        content: this.content,
        position_x: this.position_x,
        position_y: this.position_y
      });
    },
    copyNote() {
      this.showContextMenu = false;

      // 触发复制事件，传递便签信息给父组件
      this.$emit('copy', {
        id: this.id,
        title: this.title,
        content: this.content,
        position_x: this.position_x,
        position_y: this.position_y
      });
    },
    duplicateNote() {
      this.showContextMenu = false;

      // 触发直接拷贝事件，立即复制便签到附近
      this.$emit('duplicate', {
        id: this.id,
        title: this.title,
        content: this.content,
        position_x: this.position_x,
        position_y: this.position_y
      });
    },
    traceParentNotes() {
      this.showContextMenu = false;

      // 触发上文追溯事件，传递当前便签 ID
      this.$emit('trace-parent', this.id);
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
      const menuHeight = 250;  // 5个菜单项，每个约50px

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
    // 模型菜单项鼠标进入
    onModelMenuItemEnter() {
      // 清除隐藏定时器
      if (this.modelSelectorTimer) {
        clearTimeout(this.modelSelectorTimer);
        this.modelSelectorTimer = null;
      }
      // 显示侧边栏
      this.showModelSelector = true;
    },
    // 模型菜单项鼠标离开
    onModelMenuItemLeave(event) {
      // 延迟隐藏，给鼠标移动到侧边栏的时间
      this.modelSelectorTimer = setTimeout(() => {
        // 检查鼠标是否在侧边栏上
        const sidebar = document.querySelector('.model-selector-sidebar');
        if (sidebar && !sidebar.matches(':hover')) {
          this.showModelSelector = false;
        }
      }, 100);
    },
    // 模型侧边栏鼠标进入
    onModelSidebarEnter() {
      // 清除隐藏定时器
      if (this.modelSelectorTimer) {
        clearTimeout(this.modelSelectorTimer);
        this.modelSelectorTimer = null;
      }
      // 保持显示
      this.showModelSelector = true;
    },
    // 模型侧边栏鼠标离开
    onModelSidebarLeave(event) {
      // 延迟隐藏
      this.modelSelectorTimer = setTimeout(() => {
        this.showModelSelector = false;
      }, 100);
    },
    closeContextMenuOnOutsideClick(event) {
      const noteEl = this.$el;
      if (this.showContextMenu && !noteEl.contains(event.target)) {
        this.showContextMenu = false;
        // 清除模型选择器定时器
        if (this.modelSelectorTimer) {
          clearTimeout(this.modelSelectorTimer);
          this.modelSelectorTimer = null;
        }
        this.showModelSelector = false;
      }
    },
    async generateAIContent() {
      this.aiError = null;

      // 使用标题作为prompt
      const prompt = this.title;

      if (!prompt) {
        this.aiError = '请先设置便签标题';
        return;
      }

      this.isAIGenerating = true;

      // 清空编辑器内容和流式内容累积变量
      this.streamingContent = '';
      if (this.$refs.vditorEditor) {
        this.$refs.vditorEditor.setValue('');
        this.$refs.vditorEditor.focus();
      }

      try {
        // 从 localStorage 读取最后使用的模型配置（只需要 provider 和 model）
        let provider = null;
        let model = null;
        const lastUsedModel = localStorage.getItem('lastUsedModel');

        if (lastUsedModel) {
          try {
            const parts = lastUsedModel.split('|');
            if (parts.length === 2) {
              provider = parts[0];
              model = parts[1];
            }
          } catch (e) {
            console.error('Failed to parse lastUsedModel:', e);
          }
        }

        // 使用 fetch API 调用流式接口
        const response = await fetch('/api/notes/ai-generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt,
            wall_id: this.wallId,
            note_id: this.id,  // 传递当前便签ID，用于获取引入节点的上下文
            context_level: this.contextLevel,  // 传递上文层数
            include_reasoning: true,  // 请求推理模型的思考过程
            provider,  // 传递 provider（后端会从数据库读取 API Key）
            model     // 传递 model 名称
          })
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        // 读取流式数据
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // 【性能优化】后端已发送完毕，立即渲染所有累积的内容
            // 避免"数据已到齐但前端还在慢吞吞渲染"的问题
            if (this.streamingContent) {
              this.$refs.vditorEditor?.setValue(this.streamingContent);
              console.log('[Note] 流式输出完成，最终渲染内容长度:', this.streamingContent.length);
            }
            break;
          }

          // 解码数据块
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              // 检查是否为结束标记
              if (data === '[DONE]') {
                // 【性能优化】检测到结束标记，立即渲染所有累积的内容
                if (this.streamingContent) {
                  this.$refs.vditorEditor?.setValue(this.streamingContent);
                  console.log('[Note] 检测到 [DONE] 标记，最终渲染内容长度:', this.streamingContent.length);
                }
                break;
              }

              try {
                const parsed = JSON.parse(data);

                // 检查是否有错误
                if (parsed.error) {
                  this.aiError = parsed.error;
                  break;
                }

                // 累积原始内容，避免流式插入导致的层级问题
                if (parsed.content) {
                  this.streamingContent += parsed.content;

                  // 每接收到一部分内容，就渲染到编辑器（使用 setValue 而不是 insertValue）
                  // 这样可以避免光标位置导致的列表嵌套问题
                  this.$refs.vditorEditor?.setValue(this.streamingContent);

                  // 滚动到底部
                  this.$nextTick(() => {
                    const vditor = this.$refs.vditorEditor?.vditorInstance;
                    if (vditor && vditor.vditor && vditor.vditor.ir) {
                      const irElement = vditor.vditor.ir.element;
                      irElement.scrollTop = irElement.scrollHeight;
                    }
                  });
                }
              } catch (e) {
                // 忽略JSON解析错误
              }
            }
          }
        }

        // 流式接收完成后，获取最终内容并保存到数据库
        const generatedContent = this.streamingContent || this.$refs.vditorEditor?.getValue() || this.viewEditContent;

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

        // 更新编辑状态的临时内容
        this.viewEditContent = generatedContent;

      } catch (error) {
        console.error('Failed to generate AI content:', error);
        const errorMsg = error.message || 'AI生成失败';
        this.aiError = errorMsg;
      } finally {
        this.isAIGenerating = false;
      }
    },
    // 使用指定模型生成 AI 内容
    async generateAIContentWithModel(provider, model) {
      console.log('[Note] generateAIContentWithModel 被调用:', { provider, model, noteId: this.id });
      this.aiError = null;

      // 使用标题作为prompt
      const prompt = this.title;

      if (!prompt) {
        this.aiError = '请先设置便签标题';
        return;
      }

      this.isAIGenerating = true;

      // 清空流式内容累积变量
      this.streamingContent = '';

      // 立即通知父组件内容已清空（白板预览会显示为空）
      this.$emit('update', {
        id: this.id,
        title: this.title,
        content: '',
        position_x: this.position_x,
        position_y: this.position_y
      });

      try {
        console.log('[Note] 使用指定模型调用 AI 生成接口:', { prompt, provider, model });

        // 使用 fetch API 调用流式接口
        const response = await fetch('/api/notes/ai-generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt,
            wall_id: this.wallId,
            note_id: this.id,
            context_level: this.contextLevel,
            include_reasoning: true,
            provider,  // 使用指定的 provider
            model     // 使用指定的 model
          })
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        // 读取流式数据
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('[Note] 流式输出完成，最终渲染内容长度:', this.streamingContent.length);
            break;
          }

          // 解码数据块
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              // 检查是否为结束标记
              if (data === '[DONE]') {
                console.log('[Note] 检测到 [DONE] 标记，最终渲染内容长度:', this.streamingContent.length);
                break;
              }

              try {
                const parsed = JSON.parse(data);

                // 检查是否有错误
                if (parsed.error) {
                  this.aiError = parsed.error;
                  break;
                }

                // 累积内容并实时更新白板预览
                if (parsed.content) {
                  this.streamingContent += parsed.content;

                  // 实时通知父组件更新内容（白板预览会立即显示）
                  this.$emit('update', {
                    id: this.id,
                    title: this.title,
                    content: this.streamingContent,
                    position_x: this.position_x,
                    position_y: this.position_y
                  });

                  // 每100个字符输出一次日志
                  if (this.streamingContent.length % 100 === 0) {
                    console.log('[Note] 已接收内容长度:', this.streamingContent.length);
                  }
                }
              } catch (e) {
                // 忽略JSON解析错误
              }
            }
          }
        }

        // 流式接收完成后，保存最终内容到数据库
        const generatedContent = this.streamingContent;

        await axios.put(`/api/notes/${this.id}`, {
          title: this.title,
          content: generatedContent,
          position_x: this.position_x,
          position_y: this.position_y
        });

        // 确保父组件更新最终内容
        this.$emit('update', {
          id: this.id,
          title: this.title,
          content: generatedContent,
          position_x: this.position_x,
          position_y: this.position_y
        });

        // 同步到 viewEditContent（以便后续打开模态框时显示）
        this.viewEditContent = generatedContent;

        console.log('[Note] 使用指定模型生成完成');

      } catch (error) {
        console.error('Failed to generate AI content with model:', error);
        const errorMsg = error.message || 'AI生成失败';
        this.aiError = errorMsg;
      } finally {
        this.isAIGenerating = false;
      }
    },
    // 获取模型选择侧边栏的位置样式
    getModelSidebarStyle() {
      // 侧边栏显示在右键菜单的右侧，留出间距
      const menuWidth = 150;
      const gap = 10;  // 菜单和侧边栏之间的间距
      return {
        left: (this.contextMenuX + menuWidth + gap) + 'px',
        top: this.contextMenuY + 'px'
      };
    },
    // 使用指定模型拷贝便签并重新生成
    duplicateWithModel(provider, model) {
      console.log('[Note] duplicateWithModel 被调用:', { provider, model, noteId: this.id });
      // 清除定时器
      if (this.modelSelectorTimer) {
        clearTimeout(this.modelSelectorTimer);
        this.modelSelectorTimer = null;
      }
      this.showModelSelector = false;
      this.showContextMenu = false;

      // 触发事件，传递便签信息和模型配置
      this.$emit('duplicate-with-model', {
        id: this.id,
        title: this.title,
        content: this.content,
        position_x: this.position_x,
        position_y: this.position_y,
        provider: provider,
        model: model
      });
      console.log('[Note] duplicate-with-model 事件已触发');
    }

  },
  mounted() {
    document.addEventListener('click', this.closeContextMenuOnOutsideClick);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.closeContextMenuOnOutsideClick);
    // 清除模型选择器定时器
    if (this.modelSelectorTimer) {
      clearTimeout(this.modelSelectorTimer);
      this.modelSelectorTimer = null;
    }
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
  /* 强制 GPU 加速和独立渲染层 */
  will-change: transform;
  /* 确保缩放时文字清晰 */
  image-rendering: -webkit-optimize-contrast;
  /* 确保便签在连接线上方 */
  z-index: 10;
}

.note:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

/* AI生成中的便签样式 */
.note.generating {
  background: #fff9c4; /* 浅黄色 */
  box-shadow: 0 2px 12px rgba(255, 193, 7, 0.4); /* 黄色光晕 */
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 2px 12px rgba(255, 193, 7, 0.4);
  }
  50% {
    box-shadow: 0 2px 20px rgba(255, 193, 7, 0.7);
  }
}

/* 上文追溯高亮闪烁动画 */
.note.highlight-flash {
  animation: flashGreen 2s ease-in-out; /* 2秒完成两次完整闪烁 */
}

@keyframes flashGreen {
  0%, 100% {
    background: #e3f2fd; /* 默认蓝色 */
  }
  25%, 75% {
    background: #c5f7c5; /* 绿色 */
  }
  50% {
    background: #e3f2fd; /* 回到蓝色 */
  }
}

/* 选中状态样式 */
.note.selected {
  border: 3px solid #2196f3;
  box-shadow: 0 4px 20px rgba(33, 150, 243, 0.5);
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
  /* 优化文字渲染 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
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
  /* 优化文字渲染 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
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

/* 右键菜单项带子菜单 */
.context-menu-item.has-submenu {
  position: relative;
  padding-right: 30px;  /* 为箭头留出空间 */
}

.submenu-arrow {
  position: absolute;
  right: 12px;
  font-size: 12px;
  color: #999;
}

/* 模型选择侧边栏 */
.model-selector-sidebar {
  position: fixed;
  background: white;
  border-radius: 0 8px 8px 0;  /* 左侧无圆角，紧贴菜单 */
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  width: 280px;
  max-height: 400px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 1001;
  margin-left: -1px;  /* 向左偏移1px，与菜单重叠边框 */
}

.model-selector-header {
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  font-size: 14px;
  font-weight: bold;
  color: #333;
}

.model-selector-body {
  padding: 8px 0;
  overflow-y: auto;
  flex: 1;
}

.model-provider-group {
  margin-bottom: 8px;
}

.provider-name {
  padding: 6px 16px;
  font-size: 12px;
  font-weight: bold;
  color: #666;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}

.model-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 14px;
  color: #333;
}

.model-item:hover {
  background: #f5f5f5;
}

.model-icon {
  font-size: 14px;
}

.model-name {
  flex: 1;
}

.no-models {
  padding: 20px 16px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

/* 侧边栏滑入动画 */
.slide-fade-enter-active {
  transition: all 0.2s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.15s ease-in;
}

.slide-fade-enter-from {
  transform: translateX(-10px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateX(-10px);
  opacity: 0;
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
  width: 75%;
  height: 85%;
  display: flex;
  flex-direction: column;
  animation: modalAppear 0.2s ease-out;
  overflow: visible;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 8px;
  border-bottom: 1px solid #eee;
  position: relative;
  z-index: 10; /* 确保在 view-body 之上，防止 close-btn 被覆盖 */
}

.view-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.view-body {
  padding: 60px 2px 2px 2px; /* 顶部留出足够空间给 tooltip */
  flex: 1;
  overflow-y: auto;
  margin-top: -60px; /* 向上偏移以保持实际内容位置不变 */
}

.view-title {
  font-size: 28px;
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
  font-size: 28px;
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
  font-size: 30px;
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
  padding: 8px 20px;
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

.btn-ai-generate:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-ai-generate:disabled:hover {
  box-shadow: none;
  transform: none;
}

.ai-icon {
  font-size: 16px;
}

.ai-error {
  color: #f44336;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  background: #ffebee;
  margin-top: 8px;
}
</style>
