# 知识白板 (Knowledge Board)

> 将大模型的问答作为便签贴在无限白板中，通过连接线灵活地构建知识网络

[![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883?logo=vue.js)](https://vuejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3.x-003b57?logo=sqlite)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## ✨ 核心特色

### 🤖 AI 对话作为便签
每次与大模型的对话都成为可拖拽、可编辑的便签，永久保存在无限白板中。支持 Markdown 渲染，双击即可编辑。

### 🔗 连接线即上下文
通过连接线指定 AI 回答的上下文，上文追溯功能沿着连接线获取多轮对话历史（支持 1-24 层追溯）。

### 📐 无限白板空间
- **缩放**：0.25x - 3.0x 无级缩放，鼠标滚轮或按钮控制
- **平移**：按住空白处拖拽即可平移白板
- **坐标系统**：精确的屏幕坐标与世界坐标转换

### 🗂️ 多白板隔离
每个白板独立管理，支持不同主题的知识空间，侧边栏快速切换。

## 🎯 应用场景

- **知识图谱构建**：将相关概念通过连接线组织成知识网络
- **AI 对话管理**：保存和复用与大模型的多轮对话
- **思维导图**：可视化思路和知识关联
- **研究笔记**：整理研究资料和文献关联

## 🚀 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装

```bash
# 克隆项目
git clone https://github.com/your-username/knowledge-board.git
cd knowledge-board

# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 配置 AI（可选）

如需使用 AI 生成功能，配置环境变量：

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件：

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-3.5-turbo
```

### 启动

**方式一：使用 VS Code 调试配置（推荐）**

1. 打开 VS Code
2. 按 `F5` 或选择"启动全部 (Full Stack)"调试配置

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

## 📚 功能特性

### 便签管理
- ✅ 创建、编辑、删除便签
- ✅ 拖拽移动便签
- ✅ Markdown 渲染支持
- ✅ 软删除和回收站
- ✅ 双击编辑，失焦自动保存

### 连接线功能
- ✅ 拖拽创建连接
- ✅ 可视化连接线和箭头
- ✅ 点击选中，Delete 键删除
- ✅ 上文追溯（BFS 算法）
- ✅ 动态高度计算

### 白板操作
- ✅ 缩放（0.25x - 3.0x）
- ✅ 平移（拖拽空白处）
- ✅ 多白板管理
- ✅ 白板独立状态保持
- ✅ 原点十字准星定位

### 批量操作
- ✅ 框选多个便签
- ✅ Shift/Ctrl+点击多选
- ✅ 批量复制/剪切
- ✅ 跨白板粘贴
- ✅ 保持连接关系

### AI 集成
- ✅ 流式输出（SSE）
- ✅ 实时 Markdown 渲染
- ✅ 自定义系统提示词
- ✅ 视觉反馈（生成状态动画）

## 🛠️ 技术栈

### 前端
- **Vue 3** - 渐进式 JavaScript 框架
- **Vite** - 下一代前端构建工具
- **Axios** - HTTP 客户端
- **markdown-it** - Markdown 解析器
- **DOMPurify** - HTML 净化库

### 后端
- **Express.js** - Web 应用框架
- **SQLite3** - 轻量级数据库
- **Axios** - HTTP 客户端（调用 OpenAI API）
- **dotenv** - 环境变量管理

### 特色技术
- **原生 HTML5 Drag & Drop** - 拖拽实现
- **Vue 3 Teleport** - 模态框渲染
- **SVG** - 连接线绘制
- **Server-Sent Events (SSE)** - AI 流式输出

## 📖 使用指南

### 创建便签
1. 点击右下角 `+` 按钮创建新便签
2. 双击便签标题或内容进行编辑
3. 失焦自动保存到数据库

### 创建连接
1. 按住便签底部的连接点（引出点）
2. 拖拽到另一个便签顶部的连接点（引入点）
3. 释放鼠标完成连接

### 上文追溯
1. 右键点击便签，选择"上文追溯"
2. 调整左上角的追溯层数（1-24）
3. 高亮显示所有上游便签和连接线

### AI 生成内容
1. 双击便签打开查看模态框
2. 点击底部的"AI 生成内容"按钮
3. 等待生成完成，自动保存到便签

### 批量操作
1. 框选：在空白处拖拽绘制选框
2. 多选：Shift/Ctrl+点击追加选择
3. 复制/剪切：右键点击任意选中的便签
4. 粘贴：右键点击白板空白处

## 🗂️ 项目结构

```
ChatBranch2/
├── backend/               # Express 后端
│   ├── routes/
│   │   ├── boards.js      # 白板管理路由
│   │   └── notes.js       # 便签和连接路由
│   ├── database.js        # SQLite 初始化和迁移
│   ├── server.js          # Express 服务器入口
│   └── package.json
│
├── frontend/              # Vue 前端
│   └── src/
│       ├── components/
│       │   ├── Note.vue           # 单个便签组件
│       │   └── NoteWall.vue       # 便签墙容器
│       ├── App.vue                # 应用入口（多白板管理）
│       ├── main.js
│       └── ...
│   └── package.json
│
├── CLAUDE.md              # Claude Code 开发指南
└── README.md              # 项目文档
```

## 🔧 开发指南

详细的开发指南请参考 [CLAUDE.md](./CLAUDE.md)，包含：

- 数据库设计和迁移
- API 接口文档
- 前端架构细节
- 扩展项目指南
- 常见问题排查

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
