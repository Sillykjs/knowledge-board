// Vditor 配置文件
export const vditorOptions = {
  // 即时渲染模式（类似 Typora）
  // 注意：标题折叠功能在 sv 或 wysiwyg 模式下支持更好
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
    'fullscreen','edit-mode','outline'
  ],

  // 禁用缓存（避免多实例冲突）
  cache: {
    enable: false
  },

  // 高度配置 - 使用具体值而不是 auto
  height: 400,
  minHeight: 300,

  // 数学公式配置 - 使用 MathJax 以获得更好的 LaTeX 兼容性
  math: {
    engine: 'MathJax',
    inlineDigit: false,
    macros: {
      '\\RR': '\\mathbb{R}'
    },
    cdn: 'https://unpkg.com/mathjax@3.2.2/es5/tex-mml-chtml.js'
  },

  // Mermaid 配置
  mermaid: {
    theme: 'default'
  },

  // CDN 配置 - 使用 Vditor CDN 以加载最新版本的 Mermaid
  // 这将解决 Mermaid 9.1.7 对中文标点符号支持不足的问题
  cdn: 'https://unpkg.com/vditor@3.11.2',

  // 代码块配置
  code: {
    lineNumber: true
  },

  upload: {
    url: 'http://localhost:3001/api/upload/images',
    max: 5 * 1024 * 1024,
    filename(name) {
      return name.replace(/\s+/g, '_');
    },
    linkToImgUrl: false,
    withCredentials: false
  },

  // 启用 typographer 模式（自动转换标点）
  typographer: false,

  // 启用计数器
  counter: {
    enable: true
  },

  // 启用标题折叠功能
  enableHint: true,

  // 导航目录配置
  outline: {
    enable: true,
    position: 'left'
  }
};
