# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

便签墙是一个单页应用(SPA)，提供一个大型白板背景，用户可以添加、编辑、删除和拖拽便签。所有用户共享同一个便签墙。

## 技术栈

- **前端**: Vue 3 + Vite
- **后端**: Express.js
- **数据库**: SQLite3
- **拖拽**: 原生 HTML5 Drag & Drop API

## 开发命令

### 后端启动
```bash
cd backend
npm install
npm start
# 或使用 nodemon 自动重启
npm run dev
```

后端运行在 `http://localhost:3001`

### 前端启动
```bash
cd frontend
npm install
npm run dev
```

前端开发服务器运行在 `http://localhost:5173`

### 构建前端
```bash
cd frontend
npm run build
```

## 项目架构

### 目录结构
```
ChatBranch2/
├── backend/               # Express后端
│   ├── routes/
│   │   └── notes.js      # 便签API路由
│   ├── database.js       # SQLite初始化
│   ├── server.js         # Express服务器
│   ├── notes.db          # SQLite数据库文件(运行后自动生成)
│   └── package.json
│
├── frontend/             # Vue前端
│   └── src/
│       ├── components/
│       │   ├── Note.vue      # 单个便签组件
│       │   └── NoteWall.vue  # 便签墙容器
│       ├── App.vue
│       ├── main.js
│       └── ...
│   └── package.json
```

## 后端架构

### 数据库设计 (SQLite)
**notes表结构:**
- `id`: 主键，自增
- `title`: 便签标题
- `content`: 便签内容
- `position_x`: X坐标位置
- `position_y`: Y坐标位置
- `created_at`: 创建时间
- `updated_at`: 更新时间

### API接口
- `GET /api/notes` - 获取所有便签
- `POST /api/notes` - 创建便签
- `PUT /api/notes/:id` - 更新便签(标题、内容、位置)
- `DELETE /api/notes/:id` - 删除便签

数据库文件位于 `backend/notes.db`

## 前端架构

### 组件结构

**NoteWall.vue** (便签墙容器)
- 负责管理所有便签的状态
- 处理便签的添加、更新、删除
- 提供大型白板背景
- 渲染浮动添加按钮

**Note.vue** (单个便签)
- 显示便签标题和内容
- 支持点击编辑模式
- 实现拖拽功能(使用HTML5 Drag & Drop)
- 拖拽结束后更新位置到后端

### 拖拽实现
使用原生HTML5 Drag & Drop API:
- `dragstart`: 记录拖拽偏移量
- `dragover`: 允许放置
- `dragend`: 计算新位置并更新到后端

### 位置计算
便签使用 `position: absolute` 定位，坐标相对于 `.note-wall` 容器。

## 依赖说明

### 后端依赖
- `express`: Web服务器框架
- `cors`: 跨域资源共享
- `sqlite3`: SQLite数据库驱动
- `body-parser`: 请求体解析

### 前端依赖
- `vue`: Vue 3框架
- `axios`: HTTP客户端
- `vite`: 构建工具
- `@vitejs/plugin-vue`: Vue 3插件

## 开发注意事项

1. **CORS配置**: 前端通过Vite proxy代理 `/api` 到 `http://localhost:3001`
2. **数据库位置**: SQLite数据库文件 `notes.db` 在backend目录下首次运行时自动创建
3. **拖拽坐标**: 坐标是相对于容器的，需要考虑偏移量
4. **新增便签位置**: 新便签默认位置按网格布局计算，避免重叠
