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

### 预览生产构建
```bash
cd frontend
npm run preview
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

### 关键工作流程

**创建新便签流程:**
1. 用户点击"+"按钮 → `addNote()` 被调用
2. 计算新便签位置（基于现有便签数量的网格布局）
3. POST请求到 `/api/notes`
4. 后端创建记录并返回新便签数据
5. 将新便签添加到 `notes` 数组

**编辑便签流程:**
1. 用户右键点击便签 → 显示上下文菜单
2. 点击"编辑" → 打开编辑模态框
3. 用户修改标题/内容 → 修改临时变量 `editTitle` 和 `editContent`
4. 点击"保存" → PUT请求到 `/api/notes/:id` 更新数据库
5. 通过 `@update` 事件通知父组件NoteWall更新本地数据

**删除便签流程（软删除）:**
1. 用户在右键菜单点击"删除"
2. DELETE请求到 `/api/notes/:id`
3. 后端设置 `deleted_at = CURRENT_TIMESTAMP`
4. 前端从 `notes` 数组移除该便签
5. 调用 `loadRecycleNotes()` 更新回收站计数

**恢复便签流程:**
1. 用户在回收站点击"恢复"
2. POST请求到 `/api/notes/recycle-bin/restore/:id`
3. 后端设置 `deleted_at = NULL`
4. 从回收站列表移除
5. 调用 `loadNotes()` 重新加载主便签墙

**永久删除流程:**
1. 用户在回收站点击"永久删除" → `permanentDelete(noteId)` 被调用
2. 设置 `pendingDeleteNoteId = noteId` 和 `showDeleteConfirm = true`
3. 显示确认模态框
4. 用户点击"确认删除" → `confirmPermanentDelete()` 执行实际的DELETE请求
5. 用户点击"取消" → `cancelPermanentDelete()` 仅关闭模态框

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
- 查看模态框（双击打开，支持 Markdown 渲染）
- 实现拖拽功能(使用HTML5 Drag & Drop)
- 拖拽结束后更新位置到后端

### 数据流和状态管理
- 便签数据存储在 `NoteWall.vue` 的 `notes` 数组中
- 回收站数据存储在 `recycleNotes` 数组中
- 使用 Vue 3 响应式系统，数据变化自动触发UI更新
- 组件间通信通过 props（父→子）和自定义事件（子→父）
- 删除便签后自动调用 `loadRecycleNotes()` 更新回收站计数

### 模态框状态管理模式
项目使用统一的状态管理模式来控制模态框：
1. **控制变量**: 使用布尔值（如 `showDeleteConfirm`、`showClearConfirm`）控制模态框显示
2. **触发方法**: 设置控制变量为 `true` 来显示模态框（如 `permanentDelete()` 只设置状态）
3. **确认方法**: 执行实际操作并关闭模态框（如 `confirmPermanentDelete()`）
4. **取消方法**: 仅关闭模态框不执行操作（如 `cancelPermanentDelete()`）

这种模式确保模态框只在用户明确确认后才执行操作，避免使用浏览器原生的 `confirm()` 对话框。

### 拖拽实现
使用原生HTML5 Drag & Drop API:
- `dragstart`: 记录拖拽偏移量
- `dragover`: 允许放置
- `dragend`: 计算新位置并更新到后端

### Markdown 渲染实现
查看便签模态框支持 Markdown 渲染，实现位于 `Note.vue`:

**依赖库:**
- `markdown-it`: 解析 Markdown 语法为 HTML
- `dompurify`: 净化 HTML 防止 XSS 攻击

**实现细节:**
1. **初始化**: 在 `<script>` 顶部初始化 markdown-it 实例（第 80-85 行）
   - `html: false`: 禁止 HTML 标签（安全）
   - `linkify: true`: 自动转换 URL 为链接
   - `breaks: true`: 转换换行符为 `<br>`

2. **计算属性**: `renderedContent()` 方法（第 117-137 行）
   - 使用 `md.render()` 解析 Markdown
   - 使用 `DOMPurify.sanitize()` 净化 HTML
   - 仅允许安全的标签和属性
   - 错误时回退到纯文本

3. **模板渲染**: 使用 `v-html="renderedContent"`（第 67 行）
   - 元素同时有 `view-content` 和 `markdown-body` 两个 class

4. **样式实现（重要）**:
   - **使用两个 style 块**（第 304 行和第 653 行）
   - `<style scoped>`: 组件特定样式
   - `<style>`: Markdown 样式（非 scoped，必须！）

**关键实现要点:**

**为什么需要非 scoped 样式？**
- Vue 的 scoped 样式会给元素添加唯一的 `data-v-xxx` 属性
- 通过 `v-html` 动态插入的 HTML 内容**没有**这些 data 属性
- 因此 scoped 样式无法应用到 Markdown 渲染的 HTML 上
- 必须将 `.markdown-body` 相关样式放在非 scoped 的 style 块中

**避免样式冲突:**
```css
/* 默认样式 - 同时应用于 markdown 和纯文本 */
.view-content {
  font-size: 14px;
  color: #555;
  word-wrap: break-word;
}

/* 仅在非 markdown 模式下应用 */
.view-content:not(.markdown-body) {
  line-height: 1.6;
  white-space: pre-wrap;
}

/* Markdown 专用样式（非 scoped 块） */
.markdown-body {
  line-height: 1.4;
  font-size: 14px;
  /* 紧凑间距：标题 12px/6px，段落 6px，其他元素 6px */
}
```

**安全措施:**
- 禁止在 Markdown 中使用 HTML 标签（`html: false`）
- DOMPurify 白名单机制限制可用的 HTML 标签和属性
- 错误处理防止渲染失败导致崩溃

### 位置计算
便签使用 `position: absolute` 定位，坐标相对于 `.note-wall` 容器。新便签默认位置按网格布局计算（每行5个，间距270px水平、200px垂直）。

## 数据库迁移

数据库迁移逻辑在 `backend/database.js` 的 `initDb()` 函数中：
- 创建表时包含 `deleted_at` 字段
- 启动时检测字段是否存在（使用 `PRAGMA table_info`），不存在则使用 `ALTER TABLE` 添加
- 数据库文件在backend目录下首次运行时自动创建
- 如果后端已在运行且数据库已创建，需要重启后端以触发迁移

手动迁移命令（仅在自动迁移失败时使用）:
```bash
cd backend
sqlite3 notes.db "ALTER TABLE notes ADD COLUMN deleted_at DATETIME DEFAULT NULL;"
```

## 后端架构细节

### 数据库连接
- 使用单例模式：`database.js` 导出单个数据库连接
- 连接建立后自动执行 `initDb()` 进行表初始化和迁移
- 所有路由通过 `require('../database')` 获取同一数据库实例

### 路由设计模式
路由文件 `backend/routes/notes.js` 遵循以下顺序：
1. 具体路径路由（如 `/recycle-bin`）
2. 嵌套路径路由（如 `/recycle-bin/restore/:id`）
3. 参数化路径路由（如 `/:id`）

**关键**: Express路由按定义顺序匹配，更具体的路由必须在更通用的路由之前定义，否则会被错误匹配。

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
- `markdown-it`: Markdown 解析器（用于查看便签模态框）
- `dompurify`: HTML 净化库（防止 XSS 攻击）

## 前端配置

### Vite Proxy配置
前端通过Vite的proxy功能将 `/api` 请求代理到后端：
- 前端开发服务器：`http://localhost:5173`
- API请求：`/api/*` → `http://localhost:3001/api/*`
- 配置文件：`frontend/vite.config.js`

## 开发注意事项

1. **后端热加载**: 使用 `npm start` 时没有热加载，代码修改后必须手动重启。使用 `npm run dev`（nodemon）会自动重启，但数据库迁移逻辑不会重新执行。
2. **数据库位置**: SQLite数据库文件 `notes.db` 在backend目录下首次运行时自动创建
3. **路由顺序**: 添加新路由时，具体路径（如 `/recycle-bin`）必须在参数化路径（如 `/:id`）之前定义
4. **软删除**: 删除操作是软删除，不会真正从数据库删除记录，只在回收站中永久删除时才执行真正的DELETE操作
5. **模态框实现**: 项目使用自定义模态框进行确认操作（如永久删除、清空回收站），不要使用浏览器原生的 `confirm()` 或 `alert()`
6. **Markdown 内容**: 便签内容支持 Markdown 语法，仅在查看模态框中渲染（双击打开），编辑时仍为纯文本编辑
7. **v-html 与 scoped 样式（重要）**: 使用 `v-html` 渲染动态内容时，相关样式必须放在**非 scoped** 的 `<style>` 块中。因为 Vue 的 scoped 样式通过添加唯一的 `data-v-xxx` 属性来实现样式隔离，而通过 `v-html` 插入的内容不会有这些属性，导致 scoped 样式无法生效
8. **样式冲突处理**: 当元素有多个 class 时（如 `class="view-content markdown-body"`），使用 `:not()` 伪类选择器来条件性地应用样式，避免样式冲突。例如：`.view-content:not(.markdown-body)` 只在元素没有 `markdown-body` class 时才应用样式
9. **数据存储（重要）**: 不要在前端使用 localStorage 存储业务数据。所有数据持久化应该通过后端 API 与数据库交互。前端只使用 Vue 3 的响应式状态管理组件内的临时数据

## 常见问题排查

### 后端路由404错误
如果新添加的路由返回404，检查路由定义顺序。确保具体路径在参数化路径之前。

### 数据库字段不存在
如果看到 "no such column: deleted_at" 错误，重启后端服务器以触发数据库迁移。

### CORS错误
确保前端Vite开发服务器正在运行（npm run dev），它通过proxy处理API请求。不要直接在前端代码中使用完整的 `http://localhost:3001` URL。

### 拖拽不工作
检查是否在编辑模态框打开时尝试拖拽。编辑模态框打开时拖拽会被禁用。

### v-html 渲染的内容样式不生效
如果通过 `v-html` 渲染的内容（如 Markdown）样式不生效或被覆盖：
1. **检查 scoped 样式**: 相关样式是否在 `<style scoped>` 块中？如果是，移到非 scoped 的 `<style>` 块
2. **检查样式冲突**: 是否有其他 class 的样式覆盖？使用浏览器开发者工具检查实际应用的样式
3. **使用条件选择器**: 如 `.class-a:not(.class-b)` 来避免多个 class 时的样式冲突
4. **增加样式优先级**: 使用更具体的选择器或 `!important`（谨慎使用）
5. **硬刷新浏览器**: 使用 `Ctrl+Shift+R` 清除缓存并刷新
