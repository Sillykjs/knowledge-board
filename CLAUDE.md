# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

便签墙是一个单页应用(SPA)，提供一个大型白板背景，用户可以添加、编辑、删除和拖拽便签。所有用户共享同一个便签墙。包含软删除和回收站功能。

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
# 或使用 nodemon 自动重启（推荐用于开发）
npm run dev
```

后端运行在 `http://localhost:3001`

**重要**: 使用 `npm start` 时，任何代码修改都需要手动重启后端。使用 `npm run dev`（nodemon）会自动重启，但数据库迁移逻辑可能不会重新触发。

### 前端启动
```bash
cd frontend
npm install
npm run dev
```

前端开发服务器运行在 `http://localhost:5173`，支持热模块替换（HMR）。

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
│   │   └── notes.js      # 便签API路由（包含回收站相关路由）
│   ├── database.js       # SQLite初始化和迁移
│   ├── server.js         # Express服务器入口
│   ├── notes.db          # SQLite数据库文件(运行后自动生成)
│   └── package.json
│
├── frontend/             # Vue前端
│   └── src/
│       ├── components/
│       │   ├── Note.vue      # 单个便签组件
│       │   └── NoteWall.vue  # 便签墙容器（包含回收站功能）
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
- `deleted_at`: 删除时间（软删除标记，NULL表示未删除）

### 软删除机制
- **软删除**: 删除便签时设置 `deleted_at = CURRENT_TIMESTAMP`，数据仍在数据库中
- **恢复**: 恢复便签时设置 `deleted_at = NULL`
- **真删除**: 只在回收站中点击"永久删除"或"清空回收站"时执行 `DELETE FROM`

数据库文件位于 `backend/notes.db`

### API接口

**便签基本操作:**
- `GET /api/notes` - 获取所有未删除的便签
- `POST /api/notes` - 创建便签
- `PUT /api/notes/:id` - 更新便签(标题、内容、位置)
- `DELETE /api/notes/:id` - 软删除便签（移入回收站）

**回收站操作（路由必须在 /:id 之前定义）:**
- `GET /api/notes/recycle-bin` - 获取回收站中的已删除便签
- `POST /api/notes/recycle-bin/restore/:id` - 恢复便签
- `DELETE /api/notes/recycle-bin/:id` - 永久删除单个便签
- `DELETE /api/notes/recycle-bin` - 清空回收站（永久删除所有）

**路由顺序注意事项**: 在 `backend/routes/notes.js` 中，回收站相关的路由必须在 `/:id` 路由之前定义，否则会被错误匹配。具体路由按照从具体到通用的顺序排列。

## 前端架构

### 组件结构

**NoteWall.vue** (便签墙容器)
- 管理所有便签和回收站的状态
- 处理便签的添加、更新、删除
- 处理回收站的打开、关闭、恢复、永久删除
- 提供大型白板背景
- 渲染浮动添加按钮和回收站按钮
- 垃圾桶按钮显示回收站便签数量徽章

**Note.vue** (单个便签)
- 显示便签标题和内容
- 右键菜单支持编辑和删除操作
- 模态框编辑（点击编辑后弹出）
- 实现拖拽功能(使用HTML5 Drag & Drop)
- 拖拽结束后更新位置到后端

### 数据流和状态管理
- 便签数据存储在 `NoteWall.vue` 的 `notes` 数组中
- 回收站数据存储在 `recycleNotes` 数组中
- 使用 Vue 3 响应式系统，数据变化自动触发UI更新
- 组件间通信通过 props（父→子）和自定义事件（子→父）
- 删除便签后自动调用 `loadRecycleNotes()` 更新回收站计数

### 拖拽实现
使用原生HTML5 Drag & Drop API:
- `dragstart`: 记录拖拽偏移量
- `dragover`: 允许放置
- `dragend`: 计算新位置并更新到后端

### 位置计算
便签使用 `position: absolute` 定位，坐标相对于 `.note-wall` 容器。新便签默认位置按网格布局计算（每行5个，间距270px水平、200px垂直）。

## 数据库迁移

数据库迁移逻辑在 `backend/database.js` 的 `initDb()` 函数中：
- 创建表时包含 `deleted_at` 字段
- 启动时检测字段是否存在，不存在则使用 `ALTER TABLE` 添加
- 如果后端已在运行且数据库已创建，需要手动执行迁移或重启后端

手动迁移命令:
```bash
cd backend
sqlite3 notes.db "ALTER TABLE notes ADD COLUMN deleted_at DATETIME DEFAULT NULL;"
```

## 依赖说明

### 后端依赖
- `express`: Web服务器框架
- `cors`: 跨域资源共享
- `sqlite3`: SQLite数据库驱动
- `body-parser`: 请求体解析
- `nodemon` (devDependencies): 开发时自动重启服务器

### 前端依赖
- `vue`: Vue 3框架
- `axios`: HTTP客户端
- `vite`: 构建工具和开发服务器
- `@vitejs/plugin-vue`: Vue 3插件

## 开发注意事项

1. **后端热加载**: 使用 `npm start` 时没有热加载，代码修改后必须手动重启。使用 `npm run dev`（nodemon）会自动重启，但数据库迁移逻辑不会重新执行。
2. **CORS配置**: 前端通过Vite proxy代理 `/api` 到 `http://localhost:3001`
3. **数据库位置**: SQLite数据库文件 `notes.db` 在backend目录下首次运行时自动创建
4. **路由顺序**: 添加新路由时，具体路径（如 `/recycle-bin`）必须在参数化路径（如 `/:id`）之前定义
5. **软删除**: 删除操作是软删除，不会真正从数据库删除记录，只在回收站中永久删除时才执行真正的DELETE操作
