// Vditor 配置文件
export const vditorOptions = {
  // 即时渲染模式（类似 Typora）
  mode: 'ir',

  // 编辑器配置
  placeholder: '请输入内容...',
  theme: 'classic',
  // 暂时不设置 icon，使用 Vditor 默认图标
  // icon: 'ant',
  lang: 'zh_CN',

  // 工具栏配置（精简版）
  toolbar: [
    'headings', 'bold', 'italic', 'strike', '|',
    'list', 'ordered-list', 'check', '|',
    'quote', 'code', 'inline-code', '|',
    'link', 'table', '|',
    'undo', 'redo', '|',
    'preview', 'fullscreen'
  ],

  // 禁用缓存（避免多实例冲突）
  cache: {
    enable: false
  },

  // 高度配置 - 使用具体值而不是 auto
  height: 400,
  minHeight: 300,

  // 数学公式配置
  math: {
    engine: 'KaTeX',
    inlineDigit: false,
    macros: {
      '\\RR': '\\mathbb{R}'
    }
  },

  // Mermaid 配置
  mermaid: {
    theme: 'default'
  },

  // 代码块配置
  code: {
    lineNumber: true
  },

  // 快捷键
  keydown: {
    Tab: 'indent'
  },

  // 启用 typographer 模式（自动转换标点）
  typographer: false,

  // 启用计数器
  counter: {
    enable: true
  }
};
