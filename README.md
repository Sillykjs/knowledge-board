# 知识白板 (Knowledge Board)

> 将大模型的问答作为便签贴在无限白板中，通过连接线灵活地构建知识网络

[![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883?logo=vue.js)](https://vuejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3.x-003b57?logo=sqlite)](https://www.sqlite.org/)
[![Vditor](https://img.shields.io/badge/Vditor-3.x-42b883?logo=markdown)](https://vditor.js.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## ✨ 核心特色

### 🤖 AI 对话作为便签

每次与大模型的对话都成为可拖拽、可编辑的便签，永久保存在无限白板中。支持 Markdown 渲染，双击即可编辑。

### 🔗 连接线即上下文

通过连接线指定 AI 回答的上下文，上文追溯功能沿着连接线获取多轮对话历史。

### 📐 无限白板空间

- **缩放**：0.25x - 3.0x 无级缩放，鼠标滚轮或按钮控制
- **平移**：按住空白处拖拽即可平移白板
- **坐标系统**：精确的屏幕坐标与世界坐标转换

## 📸 演示

### 创建和编辑便签

![创建和编辑便签](https://github.com/Sillykjs/knowledge-board/tree/main/images/create-and-edit-notes.gif)

### 创建连接和上文追溯

![创建连接和上文追溯](https://github.com/Sillykjs/knowledge-board/tree/main/images/create-connection-and-trace.gif)

### AI 生成内容

![AI 生成内容](https://github.com/Sillykjs/knowledge-board/tree/main/images/ai-generation.gif)

### 无限白板缩放平移

![无限白板](https://github.com/Sillykjs/knowledge-board/tree/main/images/infinite-canvas.gif)

## 🎯 应用场景

- **知识图谱构建**：将相关概念通过连接线组织成知识网络
- **AI 对话管理**：保存和复用与大模型的多轮对话，快速自定义上文（通过连接线和层数）
- **思维导图**：可视化思路和知识关联
- **研究笔记**：整理研究资料和文献关联

## 🚀 快速开始

### 环境要求

- Node.js 16+
- npm

### 安装

```bash
# 克隆项目
git clone https://github.com/Sillykjs/knowledge-board.git
cd knowledge-board

# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 启动

**方式一：使用 VS Code 调试配置（推荐）**

1. 打开 VS Code
2. 调试配置选择"启动全部 (Full Stack)"

**方式二：命令行启动**

```bash
# 终端 1：启动后端
cd backend
npm run dev

# 终端 2：启动前端
cd frontend
npm run dev
```

访问 http://localhost:5173 开始使用！

## 📖 使用指南

### 创建便签

1. 点击右下角 `+` 按钮创建新便签；双击空白处创建便签
2. 双击便签标题或内容进行编辑
3. 失焦自动保存到数据库

### 创建连接

1. 按住便签底部的连接点（引出点）
2. 拖拽到另一个便签
3. 释放鼠标完成连接

### 上文追溯

1. 查看当前便签的上文引用，右键点击便签，选择"上文追溯"
2. 调整左上角的追溯层数（1-24）
3. 高亮显示所有上游便签和连接线

### AI 生成内容

1. 双击便签打开查看模态框
2. 点击底部的"AI 生成内容"按钮
3. 上文：通过连接线添加上文参考
4. 等待生成完成，自动保存到便签

### 批量操作

1. 框选：在空白处拖拽绘制选框
2. 多选：Shift/Ctrl+点击追加选择
3. 复制/剪切：右键点击任意选中的便签
4. 粘贴：右键点击白板空白处

### 配置 AI

如需使用 AI 生成功能，启动后通过左侧边栏的"模型管理 JSON"按钮配置大模型：

1. 启动应用后，点击左侧边栏右上角的"模型管理 JSON"按钮
2. 编辑模型配置 JSON（支持多个厂商）
3. 点击"保存"按钮

配置示例：

```json
[
  {
    "provider": "OpenAI",
    "apiBase": "https://api.openai.com/v1",
    "apiKey": "sk-xxx",
    "models": ["gpt-4o", "gpt-3.5-turbo"]
  },
  {
    "provider": "DeepSeek",
    "apiBase": "https://api.deepseek.com",
    "apiKey": "sk-xxx",
    "models": ["deepseek-chat"]
  }
]
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
