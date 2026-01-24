<template>
  <div
    class="vditor-editor-container"
    :class="{ 'generating': isGenerating }"
  >
    <div
      ref="vditorRef"
      :id="'vditor-' + noteId"
      class="vditor-wrapper"
    ></div>
  </div>
</template>

<script>
import Vditor from 'vditor';
import { vditorOptions } from '@/utils/vditorConfig';

export default {
  name: 'VditorEditor',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    noteId: {
      type: Number,
      required: true
    },
    isGenerating: {
      type: Boolean,
      default: false
    },
    placeholder: {
      type: String,
      default: '请输入内容...'
    }
  },
  emits: ['update:modelValue', 'ready', 'blur'],
  data() {
    return {
      vditorInstance: null,
      content: this.modelValue,
      scrollPosition: 0
    };
  },
  watch: {
    modelValue(newVal) {
      // 外部内容变化时更新编辑器
      if (this.vditorInstance && newVal !== this.vditorInstance.getValue()) {
        this.vditorInstance.setValue(newVal);
      }
    },
    isGenerating(newVal) {
      // AI 生成状态变化时，禁用/启用编辑器
      this.updateEditableState(newVal);
    }
  },
  mounted() {
    // 延迟初始化，确保 DOM 已渲染
    this.$nextTick(() => {
      this.initVditor();
    });
  },
  beforeUnmount() {
    this.destroyVditor();
  },
  methods: {
    initVditor() {
      const options = {
        ...vditorOptions,
        placeholder: this.placeholder,
        value: this.convertLatexDelimiters(this.modelValue || ''), // 初始化时转换分隔符
        after: () => {
          // 监听所有编辑模式的内容变化
          const vditor = this.vditorInstance?.vditor;

          if (vditor) {
            // IR 模式（即时渲染）
            if (vditor.ir?.element) {
              const irElement = vditor.ir.element;
              irElement.addEventListener('input', this.onContentChange);
              irElement.addEventListener('scroll', this.onScroll);
              irElement.addEventListener('blur', this.onBlur, true);
            }

            // SV 模式（分屏预览）
            if (vditor.sv?.element) {
              const svElement = vditor.sv.element;
              svElement.addEventListener('input', this.onContentChange);
            }

            // WYSIWYG 模式（所见即所得）
            if (vditor.wysiwyg?.element) {
              const wysiwygElement = vditor.wysiwyg.element;
              wysiwygElement.addEventListener('input', this.onContentChange);
            }

            // 恢复之前保存的滚动位置
            this.restoreScrollPosition();
          }

          // 根据初始状态设置可编辑状态
          if (this.isGenerating) {
            this.updateEditableState(true);
          }

          // 触发 ready 事件
          this.$emit('ready', this.vditorInstance);
        }
      };

      try {
        // 使用构造函数方式初始化
        this.vditorInstance = new Vditor(this.$refs.vditorRef.id, options);

        // 修复 tooltip 被遮挡的问题
        this.$nextTick(() => {
          this.fixTooltipPosition();
        });
      } catch (error) {
        console.error('[VditorEditor] Vditor initialization failed:', error);
      }
    },

    destroyVditor() {
      if (this.vditorInstance) {
        try {
          // 保存当前滚动位置
          this.saveScrollPosition();

          // 移除所有编辑模式的事件监听
          const vditor = this.vditorInstance?.vditor;

          if (vditor) {
            // IR 模式
            if (vditor.ir?.element) {
              const irElement = vditor.ir.element;
              irElement.removeEventListener('input', this.onContentChange);
              irElement.removeEventListener('scroll', this.onScroll);
              irElement.removeEventListener('blur', this.onBlur, true);
            }

            // SV 模式
            if (vditor.sv?.element) {
              const svElement = vditor.sv.element;
              svElement.removeEventListener('input', this.onContentChange);
            }

            // WYSIWYG 模式
            if (vditor.wysiwyg?.element) {
              const wysiwygElement = vditor.wysiwyg.element;
              wysiwygElement.removeEventListener('input', this.onContentChange);
            }
          }

          // 销毁实例
          this.vditorInstance.destroy();
        } catch (error) {
          console.error('Error destroying Vditor instance:', error);
        } finally {
          this.vditorInstance = null;
        }
      }
    },

    onContentChange() {
      if (!this.vditorInstance) return;

      let newValue = this.vditorInstance.getValue();

      // 将 LaTeX 风格的数学公式分隔符转换为 Vditor 支持的格式
      // \(...\) -> $...$
      // \[...\] -> $$...$$
      newValue = this.convertLatexDelimiters(newValue);

      this.content = newValue;
      this.$emit('update:modelValue', newValue);
    },

    /**
     * 转换 LaTeX 风格的数学公式分隔符为 Vditor 支持的格式
     * @param {string} content - Markdown 内容
     * @returns {string} 转换后的内容
     */
    convertLatexDelimiters(content) {
      // 转换块级公式：\[...\] -> $$...$$
      content = content.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (match, formula) => {
        return `$$\n${formula.trim()}\n$$`;
      });

      // 转换行内公式：\(...\) -> $...$
      content = content.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (match, formula) => {
        return `$${formula.trim()}$`;
      });

      return content;
    },

    /**
     * 流式追加内容（AI 生成时使用）
     * @param {string} text - 要追加的文本
     */
    appendContent(text) {
      if (!this.vditorInstance) return;

      // 使用 insertValue 而不是 setValue，避免重新渲染整个编辑器
      // insertValue 会在光标位置插入内容，保持编辑器稳定
      this.vditorInstance.insertValue(text);

      // 已移除自动滚动到底部
    },

    /**
     * 滚动到底部
     */
    scrollToBottom() {
      if (!this.vditorInstance) return;

      const irElement = this.vditorInstance.vditor.ir.element;
      irElement.scrollTop = irElement.scrollHeight;
    },

    /**
     * 获取编辑器内容
     * @returns {string}
     */
    getValue() {
      return this.vditorInstance ? this.vditorInstance.getValue() : '';
    },

    /**
     * 设置编辑器内容
     * @param {string} value
     */
    setValue(value) {
      if (this.vditorInstance) {
        this.vditorInstance.setValue(value);
      }
    },

    /**
     * 聚焦编辑器
     */
    focus() {
      if (this.vditorInstance) {
        this.vditorInstance.focus();
      }
    },

    /**
     * 修复 tooltip 位置问题
     * 确保工具栏的悬浮提示框不被遮挡
     */
    fixTooltipPosition() {
      // 找到工具栏容器并确保其 overflow 为 visible
      const toolbar = this.$refs.vditorRef?.querySelector('.vditor-toolbar');
      if (toolbar) {
        toolbar.style.overflow = 'visible';
      }

      // 确保所有按钮的 overflow 为 visible
      const buttons = this.$refs.vditorRef?.querySelectorAll('.vditor-toolbar button');
      buttons?.forEach(btn => {
        btn.style.overflow = 'visible';
      });
    },

    /**
     * 更新编辑器可编辑状态
     * @param {boolean} isGenerating - 是否正在生成
     */
    updateEditableState(isGenerating) {
      if (!this.vditorInstance) return;

      try {
        const irElement = this.vditorInstance.vditor?.ir?.element;
        if (!irElement) return;

        const resetElement = irElement.querySelector('.vditor-reset');
        if (!resetElement) return;

        if (isGenerating) {
          // AI 生成中：禁止编辑，但允许滚动
          resetElement.setAttribute('contenteditable', 'false');
          // 添加键盘事件监听，阻止所有键盘输入
          resetElement.addEventListener('keydown', this.onKeyDownGenerating, true);
          resetElement.addEventListener('keypress', this.onKeyDownGenerating, true);
          resetElement.addEventListener('keyup', this.onKeyDownGenerating, true);
        } else {
          // 生成完成：恢复编辑
          resetElement.setAttribute('contenteditable', 'true');
          // 移除键盘事件监听
          resetElement.removeEventListener('keydown', this.onKeyDownGenerating, true);
          resetElement.removeEventListener('keypress', this.onKeyDownGenerating, true);
          resetElement.removeEventListener('keyup', this.onKeyDownGenerating, true);
        }
      } catch (error) {
        console.error('[VditorEditor] Failed to update editable state:', error);
      }
    },

    /**
     * AI 生成时阻止键盘输入
     * @param {KeyboardEvent} event
     */
    onKeyDownGenerating(event) {
      // 阻止所有键盘事件（除了可能需要的特殊键）
      // 如果需要允许某些快捷键，可以在这里添加条件判断
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    },

    /**
     * 滚动事件处理器 - 保存滚动位置
     */
    onScroll() {
      if (!this.vditorInstance || !this.vditorInstance.vditor || !this.vditorInstance.vditor.ir) {
        return;
      }

      const irElement = this.vditorInstance.vditor.ir.element;
      if (irElement) {
        this.scrollPosition = irElement.scrollTop;
      }
    },

    /**
     * 失焦事件处理器 - 触发自动保存
     */
    onBlur() {
      // 延迟触发，确保点击事件（如关闭按钮）能够正常处理
      setTimeout(() => {
        this.$emit('blur');
      }, 100);
    },

    /**
     * 保存滚动位置到 localStorage
     */
    saveScrollPosition() {
      if (!this.vditorInstance || !this.vditorInstance.vditor || !this.vditorInstance.vditor.ir) {
        return;
      }

      const irElement = this.vditorInstance.vditor.ir.element;
      if (irElement) {
        this.scrollPosition = irElement.scrollTop;
        const storageKey = `vditor-scroll-${this.noteId}`;
        try {
          localStorage.setItem(storageKey, this.scrollPosition.toString());
        } catch (error) {
          console.warn('[VditorEditor] Failed to save scroll position:', error);
        }
      }
    },

    /**
     * 从 localStorage 恢复滚动位置
     */
    restoreScrollPosition() {
      if (!this.vditorInstance || !this.vditorInstance.vditor || !this.vditorInstance.vditor.ir) {
        return;
      }

      const storageKey = `vditor-scroll-${this.noteId}`;
      try {
        const savedPosition = localStorage.getItem(storageKey);
        if (savedPosition) {
          const position = parseInt(savedPosition, 10);
          if (!isNaN(position)) {
            this.scrollPosition = position;
            // 使用 nextTick 确保 DOM 已渲染
            this.$nextTick(() => {
              const irElement = this.vditorInstance?.vditor?.ir?.element;
              if (irElement) {
                irElement.scrollTop = this.scrollPosition;
              }
            });
          }
        }
      } catch (error) {
        console.warn('[VditorEditor] Failed to restore scroll position:', error);
      }
    }
  }
};
</script>

<style scoped>
.vditor-editor-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 400px;
  overflow: visible;
  box-sizing: border-box;
}

.vditor-wrapper {
  flex: 1;
  overflow: visible;
  min-height: 400px;
}

/* 确保 Vditor 容器可见 */
.vditor-editor-container :deep(.vditor) {
  height: 100%;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

/* AI 生成中的样式 - 黄色边框和脉冲动画 */
.vditor-editor-container.generating {
  border: 3px solid #ffc107;
  animation: pulse-border 2s ease-in-out infinite;
}

/* AI 生成中，禁止文本选择 */
.vditor-editor-container.generating :deep(.vditor-ir .vditor-reset) {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

/* AI 生成中，禁用工具栏按钮 */
.vditor-editor-container.generating :deep(.vditor-toolbar) {
  pointer-events: none;
  opacity: 0.6;
}

/* AI 生成中，大纲导航禁用交互 */
.vditor-editor-container.generating :deep(.vditor-outline) {
  pointer-events: none;
  user-select: none;
}

@keyframes pulse-border {
  0%, 100% {
    box-shadow: 0 0 12px rgba(255, 193, 7, 0.4);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 193, 7, 0.7);
  }
}
</style>
