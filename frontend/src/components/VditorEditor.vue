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

      const current = this.vditorInstance.getValue();
      this.vditorInstance.setValue(current + text);

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

/* AI 生成中的样式 */
.vditor-editor-container.generating {
  background: #fff9c4;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 12px rgba(255, 193, 7, 0.4);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 193, 7, 0.7);
  }
}
</style>
