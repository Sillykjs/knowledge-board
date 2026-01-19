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
  emits: ['update:modelValue', 'ready'],
  data() {
    return {
      vditorInstance: null,
      content: this.modelValue
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
      this.updateDisabledState(newVal);
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
        value: this.modelValue,
        after: () => {
          // 监听内容变化
          if (this.vditorInstance && this.vditorInstance.vditor && this.vditorInstance.vditor.ir) {
            const irElement = this.vditorInstance.vditor.ir.element;
            if (irElement) {
              irElement.addEventListener('input', this.onContentChange);
            }
          }

          // 根据初始状态设置禁用状态
          if (this.isGenerating) {
            this.updateDisabledState(true);
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
          // 移除事件监听
          if (this.vditorInstance.vditor && this.vditorInstance.vditor.ir && this.vditorInstance.vditor.ir.element) {
            const irElement = this.vditorInstance.vditor.ir.element;
            irElement.removeEventListener('input', this.onContentChange);
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

      const newValue = this.vditorInstance.getValue();
      this.content = newValue;
      this.$emit('update:modelValue', newValue);
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

      // 自动滚动到底部
      this.scrollToBottom();
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
     * 更新编辑器禁用状态
     * @param {boolean} disabled - 是否禁用
     */
    updateDisabledState(disabled) {
      if (!this.vditorInstance) return;

      try {
        // Vditor 提供了 disabled 方法来禁用/启用编辑器
        if (disabled) {
          this.vditorInstance.disabled();
        } else {
          // 重新启用编辑器
          this.vditorInstance.enable();
        }
      } catch (error) {
        console.error('[VditorEditor] Failed to update disabled state:', error);
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

/* AI 生成中，大纲导航禁用交互 */
.vditor-editor-container.generating :deep(.vditor-outline) {
  pointer-events: none;
  user-select: none;
}

/* AI 生成中，禁用编辑区域的交互 */
.vditor-editor-container.generating :deep(.vditor-ir) {
  pointer-events: none;
  user-select: none;
  cursor: not-allowed;
}

/* 禁用工具栏按钮 */
.vditor-editor-container.generating :deep(.vditor-toolbar) {
  pointer-events: none;
  opacity: 0.6;
}

/* 禁用输入框 */
.vditor-editor-container.generating :deep(.vditor-ir .vditor-reset) {
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
