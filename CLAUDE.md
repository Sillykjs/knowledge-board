# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 快速参考

**核心命令:**

- 启动全部（推荐）: 在 VS Code 中使用 "启动全部 (Full Stack)" 调试配置
- 启动后端: `cd backend && npm run dev` (使用 nodemon 自动重启)
- 启动前端: `cd frontend && npm run dev` (Vite 开发服务器)
- 构建前端: `cd frontend && npm run build`

**常见任务:**

- 添加新路由: 在 `backend/routes/notes.js` 中添加，具体路径必须在参数化路径之前
- 添加数据库字段: 在 `backend/database.js` 的 `initDb()` 中添加迁移逻辑
- 添加模态框: 遵循"控制变量→触发方法→确认方法→取消方法"模式
- 修复样式问题: `v-html` 渲染的内容样式必须放在非 scoped 的 `<style>` 块中
- 调试位置问题: 使用 `screenToWorld()` 和 `worldToScreen()` 坐标转换方法
- 添加便签右键菜单项: 在 Note.vue 的右键菜单中添加选项，通过 emit 事件通知父组件处理
- 实现框选功能: 参考 NoteWall.vue 的 `boxSelection` 状态管理和鼠标事件处理逻辑
- 实现高亮效果: 使用 Set 维护高亮元素 ID，配合 CSS 动画和定时器清理实现
- 实现批量复制粘贴: 参考多便签复制粘贴功能，使用相对偏移和 ID 映射保持连接关系

**关键文件:**

- `backend/server.js`: Express 服务器入口
- `backend/database.js`: 数据库初始化和迁移
- `backend/routes/notes.js`: 便签和连接 API 路由（注意路由顺序）
- `backend/routes/boards.js`: 白板管理 API 路由
- `frontend/src/components/NoteWall.vue`: 便签墙容器（缩放、平移、连接、快速创建、多选框选、上文追溯）
- `frontend/src/components/Note.vue`: 单个便签组件（拖拽、双击编辑、Markdown、Teleport）
- `frontend/src/App.vue`: 应用入口（多白板管理、侧边栏）
- `frontend/vite.config.js`: Vite 配置（API proxy）

**重要概念:**

- 软删除机制: `deleted_at` 字段标记删除状态
- 路由顺序: Express 按定义顺序匹配，具体路径必须在参数化路径之前
- 坐标系统: 白板支持缩放平移，所有位置操作需使用坐标转换
- v-html 样式: 动态内容的样式必须放在非 scoped 的 `<style>` 块中
- Teleport: 模态框使用 Teleport 传送到 body，避免受白板缩放平移影响
- 文字渲染优化: 使用 GPU 加速和字体平滑属性确保缩放时文字清晰
- 双击编辑: 查看模态框中的标题和内容都支持双击进入编辑模式，失焦自动保存
- 快速创建: 双击便签的引出点（下中心连接点）可在正下方快速创建新便签并自动连接
- 便签多选: 支持框选（拖拽空白区域）和 Shift/Ctrl+点击选择多个便签
- 多便签复制粘贴: 框选多个便签后，右键点击任意便签复制/剪切，该便签作为粘贴基准点
- 上文追溯: 右键菜单支持多层父节点追溯，可追溯层数通过界面左上角控制（1-24层）

## 项目概述

知识白板是一个创新的知识管理和 AI 对话工具，将大模型的问答作为便签贴在无限白板中，并通过连接线灵活地构建知识网络。

**核心特色：**

1. **AI 对话作为便签**：每次与大模型的对话都成为可拖拽、可编辑的便签，永久保存在无限白板中
2. **连接线即上下文**：通过连接线指定 AI 回答的上下文，上文追溯功能沿着连接线获取多轮对话历史
3. **无限白板空间**：支持缩放和平移，在无限画布上自由组织知识节点
4. **多白板隔离**：每个白板独立管理，支持不同主题的知识空间

**应用场景：**
- 知识图谱构建：将相关概念通过连接线组织成知识网络
- AI 对话管理：保存和复用与大模型的多轮对话
- 思维导图：可视化思路和知识关联
- 研究笔记：整理研究资料和文献关联

## 技术栈

- **前端**: Vue 3 + Vite
- **后端**: Express.js
- **数据库**: SQLite3
- **拖拽**: 原生 HTML5 Drag & Drop API

## 开发命令

### VS Code 调试

项目包含 VS Code 调试配置 (`.vscode/launch.json`)，可以直接使用调试功能：

- **启动后端 (Backend)**: 使用 nodemon 自动重启，支持断点调试
- **启动前端 (Frontend)**: 启动 Vite 开发服务器，自动打开浏览器
- **启动全部 (Full Stack)**: 同时启动前后端（推荐）

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

**boards表结构（白板表）:**

- `id`: 主键，自增
- `title`: 白板标题
- `system_prompt`: AI系统提示词（用于AI生成功能）
- `sort_order`: 排序顺序（用于侧边栏拖拽排序）
- `created_at`: 创建时间
- `updated_at`: 更新时间

**notes表结构:**

- `id`: 主键，自增
- `title`: 便签标题
- `content`: 便签内容
- `position_x`: X坐标位置
- `position_y`: Y坐标位置
- `wall_id`: 所属白板ID（外键，关联到 boards.id）
- `created_at`: 创建时间
- `updated_at`: 更新时间
- `deleted_at`: 删除时间（软删除标记，NULL表示未删除）

**note_connections表结构:**

- `id`: 主键，自增
- `source_note_id`: 源便签ID（外键）
- `target_note_id`: 目标便签ID（外键）
- `wall_id`: 所属白板ID（外键，关联到 boards.id）
- `created_at`: 创建时间
- 外键约束：级联删除（当便签被删除时，相关连接也会被删除）
- 唯一约束：`(source_note_id, target_note_id)` 组合必须唯一

**model_configs表结构（模型配置表）:**

- `id`: 主键，自增
- `provider`: 厂商名称（唯一，如 'OpenAI', 'DeepSeek'）
- `api_base`: API 基础地址
- `api_key`: API 密钥
- `models`: 支持的模型列表（JSON 数组字符串）
- `sort_order`: 排序顺序（用于侧边栏显示顺序）
- `created_at`: 创建时间
- `updated_at`: 更新时间
- 唯一约束：`provider` 字段唯一

### 软删除机制

- **软删除**: 删除便签时设置 `deleted_at = CURRENT_TIMESTAMP`，数据仍在数据库中
- **恢复**: 恢复便签时设置 `deleted_at = NULL`
- **真删除**: 只在回收站中点击"永久删除"或"清空回收站"时执行 `DELETE FROM`

数据库文件位于 `backend/notes.db`

### API接口

**白板管理操作:**

- `GET /api/notes/boards` - 获取所有白板列表（包含便签计数）
- `POST /api/notes/boards` - 创建新白板
- `GET /api/notes/boards/:id` - 获取单个白板配置
- `PUT /api/notes/boards/:id` - 更新白板配置（标题、系统提示词）
- `PUT /api/notes/boards/reorder` - 更新白板排序顺序
- `DELETE /api/notes/boards/:id` - 删除白板（禁止删除 id=1 的默认白板）

**便签基本操作:**

- `GET /api/notes?wall_id=1` - 获取指定白板的便签（未删除）
- `POST /api/notes` - 创建便签（需要传递 wall_id）
- `PUT /api/notes/:id` - 更新便签(标题、内容、位置)
- `DELETE /api/notes/:id` - 软删除便签（移入回收站）

**便签连接操作:**

- `GET /api/notes/connections?wall_id=1` - 获取指定白板的便签连接关系
- `POST /api/notes/connections` - 创建便签之间的连接（需要传递 wall_id）
- `DELETE /api/notes/connections/:connectionId` - 删除指定连接

**回收站操作（路由必须在 /:id 之前定义）:**

- `GET /api/notes/recycle-bin` - 获取回收站中的已删除便签
- `POST /api/notes/recycle-bin/restore/:id` - 恢复便签
- `DELETE /api/notes/recycle-bin/:id` - 永久删除单个便签
- `DELETE /api/notes/recycle-bin` - 清空回收站（永久删除所有）

**AI生成操作（路由必须在 /:id 之前定义）:**

- `POST /api/notes/ai-generate` - 使用AI生成内容（需要在侧边栏配置模型）
  - 请求体: `{ prompt: string, wall_id?: number, provider?: string, model?: string }`
  - 响应: Server-Sent Events (SSE) 格式的流式数据
  - 使用白板的 `system_prompt` 作为 system 消息
  - 从数据库读取模型配置（provider, api_base, api_key, models）

**模型配置操作:**

- `GET /api/model-config` - 获取所有模型配置（API Key 已掩码处理）
- `POST /api/model-config` - 保存模型配置（支持批量保存和更新）
- `DELETE /api/model-config` - 批量删除模型配置
  - 请求体: `{ ids: number[] }`

**路由顺序注意事项**: 在 `backend/routes/notes.js` 中，路由按照以下顺序排列：

1. 引入白板路由：`router.use('/boards', boardsRouter)`
2. 具体路径（如 `/recycle-bin`, `/connections`, `/ai-generate`）
3. 嵌套路径（如 `/recycle-bin/restore/:id`, `/connections/:connectionId`）
4. 参数化路径（如 `/:id`）

Express路由按定义顺序匹配，更具体的路由必须在更通用的路由之前定义。

## 前端架构

### 关键工作流程

**创建新便签流程:**

1. 用户点击"+"按钮 → `addNote()` 被调用
2. 计算新便签位置（基于现有便签数量的网格布局）
3. POST请求到 `/api/notes`
4. 后端创建记录并返回新便签数据
5. 将新便签添加到 `notes` 数组

**编辑便签流程:**

1. 用户双击便签 → 打开查看模态框
2. 双击标题或内容 → 进入编辑模式（切换为 input/textarea）
3. 用户修改标题/内容 → 修改临时变量 `viewEditTitle` 和 `viewEditContent`
4. 失焦或按 Enter → 自动保存到数据库（PUT请求到 `/api/notes/:id`）
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

- **Props**: 接收 `boardId`、`boardTitle`、`boardRemark` 从父组件传入
- 管理单个白板的所有便签和回收站的状态
- 处理便签的添加、更新、删除（所有 API 调用都带上 `wall_id` 参数）
- 处理回收站的打开、关闭、恢复、永久删除
- 提供大型白板背景，支持缩放和平移操作
- 渲染浮动添加按钮和回收站按钮
- 垃圾桶按钮显示回收站便签数量徽章
- 标题和备注通过计算属性 `currentTitle` 和 `currentRemark` 从 props 获取
- 双击标题可编辑，编辑后通过 `@board-updated` 事件通知父组件更新
- 缩放控制按钮组：放大、缩小、重置视图，显示当前缩放比例
- 模态框支持点击外部关闭（使用 `@click.stop` 阻止内容区域冒泡）
- **快速创建便签**: 双击便签的引出点（下中心连接点），在正下方创建新便签并自动连接
- **原点十字准星**: 在白板原点（0, 0）显示十字准星，帮助定位
- **便签多选**:
  - 支持单击选择、Shift/Ctrl+点击追加选择
  - 支持框选（拖拽空白区域绘制矩形选框）
  - 选中状态在 `selectedNoteIds` Set 中维护
  - 框选状态在 `boxSelection` 对象中管理（包含起始坐标、当前坐标、选择模式等）
- **多便签复制粘贴**:
  - 框选多个便签后，右键点击任意便签复制/剪切
  - 右键点击的便签作为粘贴基准点
  - 白板右键菜单支持粘贴操作（显示剪切板便签数量）
  - 粘贴时保持便签之间的相对位置和连接关系
  - 剪切板数据保存在 localStorage，支持跨白板粘贴
  - 剪切模式粘贴后清空剪切板，复制模式可重复粘贴
- **上文追溯**:
  - 右键菜单触发，使用 BFS 算法追溯父节点
  - 可追溯层数通过 `contextLevel` 控制（1-24层）
  - 高亮状态在 `highlightedNoteIds` 和 `highlightedConnectionIds` Set 中维护
  - 高亮效果 3 秒后自动清除，定时器在适当时机清理防止内存泄漏
- **上文层数控制组件**: 界面左上角显示和调整追溯层数（+/- 按钮或直接输入）

**App.vue** (应用入口，新增多白板管理)

- **左侧边栏**: 显示所有白板，点击切换，显示便签数量徽章，支持收起/展开
  - 展开状态：显示白板标题、便签数量徽章、删除按钮
  - 收起状态：只显示图标（当前白板为 📌，其他为 📄）
  - **拖拽排序**: 使用 vuedraggable 组件，支持拖拽白板调整顺序
    - 拖拽结束后自动保存新的排序到后端
    - 使用 `sort_order` 字段存储排序顺序
- **右侧边栏**: 便签索引面板，显示当前白板的所有便签列表
  - 支持搜索便签标题（实时过滤）
  - 点击便签项跳转到对应便签位置
  - 显示便签创建时间（相对时间格式）
  - 可折叠展开，独立于左侧边栏
- **白板列表管理**:
  - `boards`: 白板列表数组
  - `currentBoardId`: 当前选中白板ID
  - `boardViewports`: 存储每个白板的视口状态 `{ boardId: { scale, translateX, translateY } }`
  - `sidebarCollapsed`: 侧边栏是否收起
  - `rightSidebarCollapsed`: 右侧边栏是否收起
  - `currentNotes`: 当前白板的便签列表（用于右侧索引）
  - `searchQuery`: 搜索关键词
- **白板操作方法**:
  - `loadBoards()`: 加载白板列表
  - `switchBoard(boardId)`: 切换白板，保存当前白板视口状态，恢复目标白板视口状态
  - `createBoard()`: 创建新白板
  - `confirmDeleteBoard(boardId)`: 删除白板（带确认模态框）
  - `onBoardUpdated(boardData)`: 处理白板配置更新事件
  - `toggleSidebar()`: 切换侧边栏收起/展开状态
  - `toggleRightSidebar()`: 切换右侧边栏展开/收起
  - `onDragEnd()`: 拖拽结束后保存白板排序
  - `jumpToNote(note)`: 跳转到指定便签位置
- **模型配置管理**:
  - `loadModelsJson()`: 从后端加载模型配置（已掩码）
  - `parseModelsJson()`: 解析模型 JSON 字符串
  - `formatJson()`: 格式化 JSON
  - `validateAndSaveJson()`: 验证并保存模型配置到后端
    - 处理 API Key 掩码逻辑（保持原值或更新）
    - 删除用户移除的厂商配置
    - 保存后重新加载配置以获取掩码后的数据
  - `onModelChanged(modelData)`: 模型切换事件处理
- **侧边栏特性**:
  - 固定在左侧（z-index: 2000），展开宽度 250px，收起宽度 60px
  - 活跃状态高亮显示
  - 默认白板（id=1）不能删除
  - 新建白板按钮在底部
  - 模型管理按钮在新建按钮上方

**Note.vue** (单个便签)

- 显示便签标题和内容
- 右键菜单支持：
  - **复制**：将便签复制到剪切板，支持单便签和多便签复制
  - **剪切**：将便签剪切到剪切板，支持单便签和多便签剪切
  - **上文追溯**：追溯父节点，根据设定的层数高亮显示所有上游便签和连接线
  - **删除**：软删除便签到回收站
- 查看模态框（双击打开，支持 Markdown 渲染，支持点击外部关闭）
  - **双击标题**：进入标题编辑模式，保存时自动更新到数据库
  - **双击内容**：进入内容编辑模式，支持纯文本编辑，失焦自动保存
- **所有模态框使用 Teleport 传送到 body**：避免受白板缩放平移影响
- 实现拖拽功能(使用HTML5 Drag & Drop)
- 拖拽结束后更新位置到后端
- **选择状态**：接收 `isSelected` prop，选中时显示蓝色边框和阴影
- **高亮状态**：接收 `isHighlighting` prop，高亮时显示黄色边框和脉冲动画
- **连接点交互**：
  - 引入点（上中心）：双击打开查看模态框并直接进入内容编辑模式
  - 引出点（下中心）：双击在正下方创建新便签并自动连接
- **AI 生成状态显示**：当 AI 正在生成内容时，便签背景变为浅黄色并带有脉冲动画效果

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

### 点击外部关闭模态框

项目中的模态框支持点击外部区域关闭（如查看模态框、回收站模态框），实现方式：

```html
<!-- 外层遮罩添加点击事件 -->
<div class="modal-overlay" @click="closeModal">
  <!-- 内层内容阻止事件冒泡 -->
  <div class="modal-content" @click.stop>
    <!-- 内容 -->
  </div>
</div>
```

- 外层遮罩：`@click="closeModal"` - 点击半透明背景时关闭
- 内层内容：`@click.stop` - 阻止点击事件冒泡，点击内容区域不关闭

### 拖拽实现

使用原生HTML5 Drag & Drop API:

- `dragstart`: 记录拖拽偏移量
- `dragover`: 允许放置（在 NoteWall 容器上）
- `dragend`: 计算新位置并更新到后端

拖拽时自动禁用：当编辑或查看模态框打开时，拖拽功能会被禁用以防止冲突。

### Teleport 使用（重要）

项目中所有模态框（右键菜单、查看模态框）都使用 Vue 3 的 Teleport 功能传送到 `body`：

**为什么需要 Teleport？**

- 白板使用 `transform: scale()` 进行缩放，子元素会继承缩放变换
- 如果模态框放在 `.wall-content` 内，会随白板缩放而变形、模糊或位置错误
- Teleport 将模态框传送到 `body`，完全脱离白板的变换影响

**实现方式：**

```html
<Teleport to="body">
  <div v-if="showModal" class="modal-overlay">
    <!-- 模态框内容 -->
  </div>
</Teleport>
```

**关键要点：**

- 所有 Note.vue 中的模态框都使用 Teleport 包装
- 模态框样式使用 `position: fixed`，相对于视口定位
- 这样无论白板如何缩放平移，模态框都保持正常显示

### 便签墙配置功能

便签墙支持自定义标题和系统提示词，实现位于 `NoteWall.vue`：

- **标题显示**: 页面顶部显示大标题
- **编辑功能**: 双击标题打开编辑模态框，可修改标题和系统提示词
- **数据持久化**: 配置保存在 `boards` 表中（每个白板独立存储）
- **API接口**: `GET/PUT /api/notes/boards/:id`
- **Props 传递**: 通过 App.vue 的 props 传入 `boardTitle` 和 `boardSystemPrompt`
- **加载时机**: 通过 props 响应式更新，无需手动加载

### Markdown 编辑器实现

项目使用 **Vditor** 作为 Markdown 编辑器，替代了原有的 markdown-it 方案：

**组件位置**: `frontend/src/components/VditorEditor.vue`

**Vditor 配置**: `frontend/src/utils/vditorConfig.js`

**核心特性:**

1. **所见即所得（WYSIWYG）**: 支持即时渲染和编辑
2. **双向绑定**: 使用 `v-model` 绑定内容，支持 `update:modelValue` 事件
3. **AI 生成集成**: 接收 `isGenerating` prop，生成时禁用编辑器
4. **滚动保持**: 生成过程中保持编辑器滚动位置
5. **失焦保存**: 触发 `blur` 事件，自动保存内容
6. **初始化回调**: 编辑器准备好后触发 `ready` 事件

**Vditor vs markdown-it:**

- **Vditor**: 完整的 Markdown 编辑器，支持所见即所得编辑、实时预览、代码高亮、数学公式等
- **markdown-it**: 仅用于解析和渲染 Markdown，不支持编辑交互

**为什么使用 Vditor？**

- 提供更好的用户体验（所见即所得）
- 内置安全性处理（XSS 防护）
- 支持丰富的 Markdown 扩展语法
- 更好的中文支持

**使用方式:**

```vue
<VditorEditor
  ref="vditorEditor"
  v-model="viewEditContent"
  :note-id="id"
  :is-generating="isAIGenerating"
  placeholder="开始编辑..."
  @blur="saveViewContent"
/>
```

**配置文件**: `frontend/src/utils/vditorConfig.js` 导出 Vditor 的初始化选项

**主要配置项:**

- `mode`: 编辑模式（'ir' = 即时渲染，类似 Typora）
- `height`: 编辑器高度（400px）
- `minHeight`: 最小高度（300px）
- `placeholder`: 占位符文本
- `theme`: 主题（'classic'）
- `lang`: 语言（'zh_CN'）
- `toolbar`: 工具栏配置（精简版）
  - 标题、粗体、斜体、删除线
  - 列表、有序列表、待办
  - 引用、代码块、行内代码
  - 链接、表格
  - 撤销、重做
  - 全屏、编辑模式切换、大纲
- `cache`: 禁用缓存（避免多实例冲突）
- `math`: 数学公式配置（KaTeX 引擎）
- `mermaid`: 流程图配置
- `code`: 代码块配置（显示行号）
- `counter`: 启用计数器
- `enableHint`: 启用标题折叠功能
- `outline`: 导航目录配置（左侧显示）

### AI 内容生成功能

查看便签模态框底部有"AI 生成内容"按钮，点击后使用便签标题作为prompt向AI请求内容：

**模型配置**:

- 通过左侧边栏的"模型管理 JSON"按钮配置
- 支持多个厂商（OpenAI、DeepSeek、等）
- 每个厂商配置包含：provider、apiBase、apiKey、models 数组
- 配置保存在数据库的 `model_configs` 表中

**API接口**:

- `POST /api/notes/ai-generate` - AI生成内容接口（支持流式输出，使用SSE）
  - 请求体: `{ prompt: string, wall_id?: number, provider?: string, model?: string }`
  - 响应: Server-Sent Events (SSE) 格式的流式数据
    - `data: {"content":"文本片段"}` - 内容块
    - `data: [DONE]` - 流结束标记
  - **System Prompt**: 从白板的 `system_prompt` 字段获取，作为 system 消息发送给 AI
  - **模型配置**: 从数据库读取，根据 provider 查找对应的 api_key、api_base 和 models

**前端实现**（Note.vue）:

- **流式输出**: 使用 fetch API 和 ReadableStream 接收SSE数据，逐步显示在模态框中
- 按钮状态：生成中显示"⏳ 生成中..."并禁用
- 实时渲染：生成过程中实时渲染 Markdown，内容逐步显示
- 错误处理：失败时在按钮下方显示错误信息
- 自动保存：生成完成后自动更新到数据库
- **视觉反馈**: 生成中便签显示浅黄色背景和脉冲动画（`.note.generating` class）
  - 背景色：`#fff9c4`（浅黄色）
  - 光晕效果：黄色阴影并带有脉冲动画（2秒循环）
  - 状态保持：即使关闭模态框，便签仍保持生成状态，直到完成或失败

**技术实现细节**:

- 后端使用 axios 的 `responseType: 'stream'` 接收 OpenAI 的流式响应
- 后端设置 SSE 响应头（`Content-Type: text/event-stream`）
- 前端使用 `fetch` API 和 `ReadableStream` 读取流式数据
- 前端计算属性 `renderedContent()` 在生成过程中显示 `streamingContent`
- 每次接收到内容块时更新 `streamingContent`，触发响应式更新

### 位置计算

便签使用 `position: absolute` 定位，坐标相对于 `.note-wall` 容器。新便签默认位置按网格布局计算（每行5个，间距270px水平、200px垂直）。

### 白板缩放和平移功能

便签墙支持缩放和平移操作，实现位于 `NoteWall.vue`：

**视图状态管理:**

- `viewport.scale`: 缩放比例（范围 0.25 ~ 3.0，默认 1.0）
- `viewport.translateX`: X轴平移偏移量
- `viewport.translateY`: Y轴平移偏移量
- `zoomLimits`: 定义缩放限制（min: 0.25, max: 3.0, step: 0.1）

**实现方式:**

1. **CSS Transform**: 使用 `transform: translate() scale()` 应用缩放和平移

   - 变换原点固定为左上角（`transformOrigin: '0 0'`）
   - `.wall-content` 容器承载变换，标题和按钮在容器外不受影响
2. **坐标转换系统**:

   - `screenToWorld()`: 屏幕坐标 → 白板世界坐标（除以 scale 再减去偏移）
   - `worldToScreen()`: 白板世界坐标 → 屏幕坐标（乘以 scale 再加上偏移）
   - 所有拖拽和连接操作都通过坐标转换确保位置准确
3. **缩放操作**:

   - **鼠标滚轮**: `onWheel()` 事件，调用 `zoomAtPoint()` 实现以鼠标位置为中心的缩放
   - **缩放按钮**: 右下角控制面板提供放大(+)/缩小(-)/重置(⟲)按钮
   - **缩放算法**: 先计算缩放前鼠标指向的世界坐标，缩放后调整平移偏移使该点保持在鼠标下
4. **平移操作**:

   - **鼠标拖拽**: `onWallMouseDown/Move/Up` 事件处理
   - 通过 `isPanning` 状态标志区分平移和便签拖拽
   - 按住空白处拖拽可平移白板

**关键实现细节**:

1. NoteWall.vue - 监听 `@wheel.prevent` 禁用默认滚动
2. NoteWall.vue - `wallTransformStyle` 计算属性生成 CSS transform
3. NoteWall.vue - `zoomAtPoint()` 方法实现以鼠标为中心的缩放
4. NoteWall.vue - 标题容器独立于 `.wall-content`，不受变换影响
5. 便签高度计算需要除以 scale：`noteElement.offsetHeight / this.viewport.scale`

**注意**: 具体行号可能随代码更新而变化，建议使用编辑器的搜索功能查找相关代码。

**交互冲突处理**:

- 平移操作 (`isPanning`) 和便签拖拽互斥，通过事件目标判断
- 连接操作 (`isConnecting`) 会禁用便签拖拽
- 缩放操作通过滚轮独立触发，不影响拖拽

**文字渲染优化（重要）**:
为解决缩放时文字模糊的问题，使用了以下 CSS 优化：

在 `.wall-content` 和 `.note` 样式中添加：

```css
/* 启用 GPU 加速和优化渲染质量 */
transform-style: preserve-3d;
backface-visibility: hidden;
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

**为什么需要这些优化？**

- `transform-style: preserve-3d`: 启用 3D 变换上下文，强制使用 GPU 渲染
- `backface-visibility: hidden`: 隐藏元素背面，进一步优化 GPU 渲染
- `-webkit-font-smoothing: antialiased`: 启用次像素抗锯齿，使文字边缘更平滑
- `-moz-osx-font-smoothing: grayscale`: 在 macOS Firefox 上改善字体渲染

这些属性确保白板缩放时，便签中的文字保持清晰锐利，不会出现锯齿或模糊。

### 便签多选和框选功能

便签墙支持多种选择模式，方便批量操作：

**选择方式:**

1. **单击选择**: 点击便签即可选中（取消其他已选便签）
2. **Shift/Ctrl+点击**: 切换模式，追加或取消选择该便签，不影响其他已选便签
3. **框选**: 在空白处按住鼠标拖拽，绘制矩形选框，框内的所有便签会被选中
   - 框选期间显示半透明蓝色选框
   - 框选支持两种模式：
     - 普通模式：框选后取消之前的选择，只保留框内便签
     - 切换模式（Shift/Ctrl）：框选结果追加到当前选择

**视觉反馈:**

- 选中的便签显示蓝色边框和阴影效果
- 框选矩形显示为半透明蓝色边框
- 选中状态在 `selectedNoteIds` Set 中维护

**使用场景:**

- 批量移动便签（未来功能）
- 批量删除便签（未来功能）
- 批量建立连接（未来功能）

**实现位置:**

- 状态管理: NoteWall.vue `boxSelection` 对象和 `selectedNoteIds` Set
- 框选逻辑: `onWallMouseDown`, `onWallMouseMove`, `onWallMouseUp`
- 样式渲染: Note.vue 接收 `isSelected` prop

### 上文追溯功能

支持多层父节点追溯，用于查看便签的上下文关系：

**功能说明:**

- 通过右键菜单触发"上文追溯"
- 使用广度优先搜索（BFS）算法遍历父节点
- 可追溯层数通过界面左上角控制组件调整（1-24层）
- 追溯时高亮显示相关便签和连接线

**追溯算法:**

1. 从当前便签开始，向上查找所有父节点（通过 `target_note_id` 反向查找）
2. 按层数逐级扩展，直到达到设定的层数或没有更多父节点
3. 高亮显示所有追溯到的便签和连接线
4. 高亮效果在 3 秒后自动消失（防止内存泄漏）

**视觉效果:**

- 追溯到的便签显示黄色边框和脉冲动画
- 追溯路径上的连接线闪烁高亮
- 高亮效果使用 `highlight-flash` class 实现

**控制组件:**

- 位置: 白板左上角（缩放控制下方）
- 显示: 当前层数（如"上文层数: 3"）
- 操作: +/- 按钮调整层数，或直接输入数字
- 范围: 1-24 层

**实现位置:**

- 状态管理: NoteWall.vue `contextLevel` 变量和 `highlightedNoteIds`, `highlightedConnectionIds` Set
- 追溯逻辑: `onTraceParent` 和 BFS 算法实现
- 高亮清除: `clearHighlights` 方法和定时器清理
- 控制组件: 模板中的 `context-level-control` 区域

**注意事项:**

- 高亮定时器会在组件销毁或下次追溯时自动清理，防止内存泄漏
- 追溯算法使用 Set 避免重复访问，提高性能
- 连接线闪烁动画使用 CSS `@keyframes` 实现

## 数据库迁移

数据库迁移逻辑在 `backend/database.js` 的 `initDb()` 函数中：

- 创建 `boards` 表（白板表）
- 从 `wall_config` 表迁移数据到 `boards` 表（id=1 为默认白板），然后删除 `wall_config` 表
- 为 `notes` 表添加 `wall_id` 外键字段（默认值 1），并创建索引
- 为 `note_connections` 表添加 `wall_id` 外键字段（默认值 1），并创建索引
- 启动时检测字段是否存在（使用 `PRAGMA table_info`），不存在则使用 `ALTER TABLE` 添加
- 数据库文件在backend目录下首次运行时自动创建
- 如果后端已在运行且数据库已创建，需要重启后端以触发迁移

**多白板迁移步骤**:

1. 创建 `boards` 表
2. 检查 `wall_config` 表是否存在，如果存在则迁移数据到 `boards` 表（id=1）
3. 为 `notes` 表添加 `wall_id` 字段（如果不存在）
4. 为 `note_connections` 表添加 `wall_id` 字段（如果不存在）

手动迁移命令（仅在自动迁移失败时使用）:

```bash
cd backend

# 创建 boards 表
sqlite3 notes.db "CREATE TABLE IF NOT EXISTS boards (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL DEFAULT '新白板', remark TEXT NOT NULL DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);"

# 从 wall_config 迁移数据
sqlite3 notes.db "INSERT INTO boards (id, title, remark) SELECT 1, title, remark FROM wall_config;"

# 为 notes 表添加 wall_id
sqlite3 notes.db "ALTER TABLE notes ADD COLUMN wall_id INTEGER NOT NULL DEFAULT 1;"

# 为 note_connections 表添加 wall_id
sqlite3 notes.db "ALTER TABLE note_connections ADD COLUMN wall_id INTEGER NOT NULL DEFAULT 1;"
```

## 后端架构细节

### 数据库连接

- 使用单例模式：`database.js` 导出单个数据库连接
- 连接建立后自动执行 `initDb()` 进行表初始化和迁移
- 所有路由通过 `require('../database')` 获取同一数据库实例

### 路由设计模式

**主要路由文件**:

- `backend/routes/boards.js`: 白板管理路由（新建）
- `backend/routes/notes.js`: 便签和连接路由（已修改）

**boards.js 路由**（白板管理）:

- `GET /` - 获取所有白板（包含便签计数，按 sort_order 排序）
- `POST /` - 创建新白板（需要 `title`，可选 `system_prompt`）
- `GET /:id` - 获取单个白板配置
- `PUT /:id` - 更新白板配置（需要 `title`，可选 `system_prompt`）
- `PUT /reorder` - 批量更新白板排序（需要 `boardOrders` 数组）
- `DELETE /:id` - 删除白板（禁止删除 id=1）

**notes.js 路由顺序**:

1. 引入白板路由：`router.use('/boards', boardsRouter)`
2. **具体路径路由**（如 `/recycle-bin`, `/connections`）
3. **嵌套路径路由**（如 `/recycle-bin/restore/:id`, `/connections/:connectionId`）
4. **参数化路径路由**（如 `/:id`）

**关键**: Express路由按定义顺序匹配，更具体的路由必须在更通用的路由之前定义，否则会被错误匹配。

**多白板支持**:

- 所有便签相关 API 必须传递 `wall_id` 参数（默认值 1）
- 所有连接相关 API 必须传递 `wall_id` 参数（默认值 1）
- 使用 `req.query.wall_id || 1` 获取白板ID
- 使用 `req.body.wall_id || 1` 获取请求体中的白板ID

### 便签连接功能

后端实现了便签之间的连接关系管理：

- **连接表**: `note_connections` 表存储便签之间的关系
- **级联删除**: 当便签被删除时，相关的连接会自动删除（外键约束）
- **唯一约束**: 同一对便签之间只能存在一个连接
- **查询优化**: 在 `source_note_id` 和 `target_note_id` 字段上建立了索引
- **软删除过滤**: 获取连接时会自动过滤掉已删除便签的连接

前端实现便签间的可视化连接：

- **SVG 连线层**: 在 NoteWall 组件中使用 SVG 绘制连接线和箭头，位于 `.wall-content` 内随白板缩放平移
- **连接点**: 每个便签顶部（引入点）和底部（引出点）各有一个连接点
- **拖拽创建**: 从引出点拖拽到引入点可创建新连接
- **动态高度计算**: 连接点位置会根据便签的实际高度动态调整（通过 `offsetHeight / scale` 获取）
- **连接选择**: 点击连接线可选中，按 Delete 键删除
- **拖拽冲突处理**: 创建连接时会禁用便签拖拽（通过 `isConnecting` 状态标志）

**关键实现细节**:

1. Note.vue:4 - 便签元素添加 `data-note-id` 属性用于 DOM 查询
2. NoteWall.vue - `getConnectionStartPoint` 和 `getConnectionEndPoint` 方法动态获取便签高度
3. NoteWall.vue - 拖拽开始时优先使用 DOM API 获取连接点精确位置
4. Note.vue:206 - `onDragStart` 中检查 `isConnecting` 标志防止连接操作触发便签拖拽
5. **坐标转换**: 连接点计算需要考虑缩放比例，使用 `offsetHeight / scale` 获取真实高度

**注意**: 具体行号可能随代码更新而变化，建议使用编辑器的搜索功能查找相关代码。

## 依赖说明

### 后端依赖

- `express`: Web服务器框架
- `cors`: 跨域资源共享
- `sqlite3`: SQLite数据库驱动
- `body-parser`: 请求体解析
- `axios`: HTTP客户端（用于调用OpenAI兼容API）
- `nodemon` (devDependencies): 开发时自动重启服务器

### 前端依赖

- `vue`: Vue 3框架
- `axios`: HTTP客户端
- `vite`: 构建工具和开发服务器
- `@vitejs/plugin-vue`: Vue 3插件
- `vditor`: Markdown 编辑器（用于便签内容的编辑和预览）
- `vuedraggable`: 基于 Vue 3 的拖拽排序组件（用于侧边栏白板排序）
- `dompurify`: HTML 净化库（防止 XSS 攻击，已被 Vditor 替代）

## 前端配置

### Vite Proxy配置

前端通过Vite的proxy功能将 `/api` 请求代理到后端：

- 前端开发服务器：`http://localhost:5173`
- API请求：`/api/*` → `http://localhost:3001/api/*`
- 配置文件：`frontend/vite.config.js`

## 开发注意事项

1. **后端热加载**: 使用 `npm start` 时没有热加载，代码修改后必须手动重启。使用 `npm run dev`（nodemon）会自动重启，但数据库迁移逻辑不会重新执行。
2. **数据库位置**: SQLite数据库文件 `notes.db` 在backend目录下首次运行时自动创建
3. **路由顺序**: 添加新路由时，具体路径（如 `/config`, `/recycle-bin`, `/connections`, `/ai-generate`）必须在参数化路径（如 `/:id`）之前定义
4. **软删除**: 删除操作是软删除，不会真正从数据库删除记录，只在回收站中永久删除时才执行真正的DELETE操作
6. **模态框实现**: 项目使用自定义模态框进行确认操作（如永久删除、清空回收站），不要使用浏览器原生的 `confirm()` 或 `alert()`
7. **Markdown 内容**: 便签内容支持 Markdown 语法，仅在查看模态框中渲染（双击打开），编辑时仍为纯文本编辑
8. **点击外部关闭模态框**: 查看模态框和回收站模态框支持点击外部区域关闭，使用 `@click` 和 `@click.stop` 实现事件处理
9. **v-html 与 scoped 样式（重要）**: 使用 `v-html` 渲染动态内容时，相关样式必须放在**非 scoped** 的 `<style>` 块中。因为 Vue 的 scoped 样式通过添加唯一的 `data-v-xxx` 属性来实现样式隔离，而通过 `v-html` 插入的内容不会有这些属性，导致 scoped 样式无法生效
10. **样式冲突处理**: 当元素有多个 class 时（如 `class="view-content markdown-body"`），使用 `:not()` 伪类选择器来条件性地应用样式，避免样式冲突。例如：`.view-content:not(.markdown-body)` 只在元素没有 `markdown-body` class 时才应用样式
11. **数据存储（重要）**: 不要在前端使用 localStorage 存储业务数据。所有数据持久化应该通过后端 API 与数据库交互。前端只使用 Vue 3 的响应式状态管理组件内的临时数据。**例外**: 剪切板数据（clipboardData）使用 localStorage 存储，以支持跨白板粘贴和页面刷新后保持剪切板内容
12. **拖拽禁用**: 当编辑或查看模态框打开时，拖拽功能会被自动禁用以防止冲突
13. **缩放平移状态（重要）**: 白板支持缩放和平移，所有涉及位置计算的操作（拖拽便签、连接线绘制）都必须使用坐标转换方法 `screenToWorld()` 和 `worldToScreen()` 来确保位置准确
14. **多白板状态管理（重要）**: 每个白板的视口状态（scale、translateX、translateY）独立保存在 App.vue 的 `boardViewports` 对象中。切换白板时，先保存当前状态到 `boardViewports[currentBoardId]`，再恢复目标白板的状态
15. **DOM 尺寸获取与缩放**: 当白板缩放后，通过 `offsetHeight` 或 `offsetWidth` 获取的元素尺寸是屏幕空间的值，需要除以 `viewport.scale` 才能得到白板世界坐标系的实际尺寸
16. **模态框使用 Teleport（重要）**: 所有 Note.vue 中的模态框（右键菜单、编辑、查看）都必须使用 `<Teleport to="body">` 传送到 body，避免受白板缩放平移影响。新添加模态框时务必遵循此模式
17. **文字渲染优化**: 在 `.wall-content` 和 `.note` 样式中必须包含 GPU 加速和字体平滑属性（`transform-style: preserve-3d`、`backface-visibility: hidden`、`-webkit-font-smoothing: antialiased`），确保缩放时文字清晰
18. **白板 API 参数（重要）**: 所有便签和连接相关 API 调用都必须传递 `wall_id` 参数。在 NoteWall.vue 中使用 `this.boardId`，在 axios 调用中通过 `params: { wall_id: this.boardId }` 传递
19. **AI 生成状态（重要）**: 便签在 AI 生成时会显示浅黄色背景和脉冲动画（通过 `isAIGenerating` 状态控制）。即使关闭查看模态框，生成状态仍会保持，直到完成或失败
20. **右键菜单高度计算**: 添加新的右键菜单项后，需要调整 `onContextMenu` 方法中的 `menuHeight` 值，确保菜单不会被屏幕底部裁剪（每个菜单项约 50px）
21. **Vue 事件处理陷阱（重要）**: 在 Vue 模板中绑定事件时，如果方法不需要接收事件参数，务必使用**显式调用**（带括号）。

    - ✅ **正确写法**: `@click="addNote()"` - 显式调用方法，不传递任何参数
    - ❌ **错误写法**: `@click="addNote"` - Vue 会自动将 `$event`（事件对象）作为第一个参数传递
    - **示例场景**:
      ```javascript
      // 错误：addNote(PointerEvent) 被调用，导致逻辑错误
      <button @click="addNote">创建</button>

      // 正确：addNote() 被调用，参数为默认值 null
      <button @click="addNote()">创建</button>
      ```
    - **问题症状**: 如果方法中有类似 `customPosition || this.calculateNewPosition()` 的逻辑，使用错误写法会导致事件对象（truthy 值）覆盖默认值，使得备用逻辑永远不会执行
    - **调试技巧**: 当方法接收到意外参数时，检查事件绑定是否使用了显式调用。可以通过在方法开头添加 `console.log('参数:', parameter)` 来验证
22. **定时器内存管理（重要）**: 使用定时器时必须在适当时机清理，防止内存泄漏。

    - **组件销毁时清理**: 在 `beforeUnmount` 生命周期钩子中清除所有活动定时器
    - **重新设置前清理**: 在创建新定时器前，先清除已有的定时器（如高亮效果）
    - **示例模式**:
      ```javascript
      // 清除已有定时器
      if (this.highlightTimer) {
        clearTimeout(this.highlightTimer);
        this.highlightTimer = null;
      }

      // 创建新定时器
      this.highlightTimer = setTimeout(() => {
        this.clearHighlights();
      }, 3000);
      ```
    - **常见场景**: 高亮效果自动清除、防抖/节流、延迟加载等
    - **调试技巧**: 使用浏览器开发者工具的 Memory 面板检查分离的 DOM 节点数量，或在控制台输出定时器 ID 验证是否被清理

## 数据库管理

### 数据库文件位置

- SQLite数据库文件位于 `backend/notes.db`
- 数据库文件已添加到 `.gitignore`，不会被提交到版本控制
- 每个开发者需要在本地首次运行后端时自动创建数据库

### 数据库迁移机制

项目使用自动迁移机制：

- 启动后端时自动检查并创建表
- 使用 `PRAGMA table_info` 检查字段是否存在
- 如果字段不存在，使用 `ALTER TABLE` 添加新字段
- 迁移逻辑在 `backend/database.js` 的 `initDb()` 函数中

### 查询数据库

使用 SQLite 命令行工具查询数据库：

```bash
cd backend
sqlite3 notes.db

# 查看所有表
.tables

# 查看表结构
.schema notes
.schema boards
.schema note_connections

# 查询所有白板
SELECT * FROM boards;

# 查询某个白板的便签
SELECT * FROM notes WHERE wall_id = 1 AND deleted_at IS NULL;

# 查询某个白板的连接
SELECT * FROM note_connections WHERE wall_id = 1;

# 查询回收站
SELECT * FROM notes WHERE deleted_at IS NOT NULL;

# 退出
.quit
```

## 常见问题排查

### 后端路由404错误

如果新添加的路由返回404，检查路由定义顺序。确保具体路径在参数化路径之前。

### 数据库字段不存在

如果看到 "no such column: deleted_at" 错误，重启后端服务器以触发数据库迁移。

### 数据库锁定错误

如果看到 "database is locked" 错误：

1. 检查是否有多个后端进程在运行（使用 `ps aux | grep node` 或任务管理器）
2. 确保没有其他程序正在访问 `backend/notes.db` 文件
3. 重启后端服务器
4. 如果问题持续，删除 `backend/notes.db` 文件并重新启动后端（会自动创建新数据库）

### CORS错误

确保前端Vite开发服务器正在运行（npm run dev），它通过proxy处理API请求。不要直接在前端代码中使用完整的 `http://localhost:3001` URL。

### 前端无法连接后端

如果前端显示 "Network Error" 或无法连接到后端：

1. 确认后端正在运行（访问 http://localhost:3001/api/health）
2. 检查端口3001是否被其他程序占用
3. 确认 Vite proxy 配置正确（`frontend/vite.config.js`）
4. 检查浏览器控制台的 Network 面板查看请求详情

### 拖拽不工作

检查是否在编辑或查看模态框打开时尝试拖拽。模态框打开时拖拽会被自动禁用以防止冲突。

### 连接线位置不正确

如果连接线的起点或终点没有对准连接点：

1. **便签高度变化**: 当便签内容增加时高度会增长，连接线位置会自动调整（通过 `offsetHeight / scale` 动态获取）
2. **缩放影响**: 如果白板被缩放，连接线计算需要考虑缩放比例。检查是否正确使用了 `offsetHeight / viewport.scale`
3. **强制刷新**: 修改便签内容后，如果连接线位置未更新，尝试刷新页面或重新加载
4. **检查 data-note-id**: 确保每个便签元素都有正确的 `data-note-id` 属性
5. **浏览器缓存**: 使用 `Ctrl+Shift+R`（Windows/Linux）或 `Cmd+Shift+R`（Mac）硬刷新浏览器清除缓存

### 连接操作触发便签移动

如果在连接点上拖拽时触发了便签的移动，检查：

1. Note.vue:206 - 确保 `onDragStart` 中检查了 `isConnecting` 标志
2. 事件冒泡：连接点事件使用 `@mousedown.stop` 阻止冒泡
3. 状态标志：确保父组件正确传递了 `isConnecting` 状态

### 缩放或平移后便签位置错误

如果白板缩放或平移后，便签位置显示不正确：

1. **坐标转换**: 确保所有位置相关操作都使用了 `screenToWorld()` 和 `worldToScreen()` 方法
2. **拖拽计算**: 检查便签拖拽时的位置计算是否考虑了当前缩放比例 `viewport.scale`
3. **新便签位置**: 创建新便签时，确保网格布局计算使用的是世界坐标系
4. **CSS transform**: 检查 `.wall-content` 的 transform 样式是否正确应用

### 缩放控制不工作

如果缩放功能无法使用：

1. **事件监听**: 检查 NoteWall.vue:10 的 `@wheel.prevent` 事件是否正确绑定
2. **缩放限制**: 确认缩放值在 0.25 ~ 3.0 范围内
3. **CSS 性能**: 检查 `.wall-content` 是否有 `will-change: transform` 属性以优化性能
4. **浏览器兼容**: 确保浏览器支持 CSS transform 和 wheel 事件

### 缩放时文字模糊

如果白板放大后便签中的文字变模糊：

1. **检查渲染优化属性**: 确认 `.wall-content` 和 `.note` 样式中包含以下属性：
   - `transform-style: preserve-3d`
   - `backface-visibility: hidden`
   - `-webkit-font-smoothing: antialiased`
   - `-moz-osx-font-smoothing: grayscale`
2. **硬刷新浏览器**: 使用 `Ctrl+Shift+R`（Windows/Linux）或 `Cmd+Shift+R`（Mac）清除缓存
3. **浏览器 GPU 加速**: 确保浏览器启用了硬件加速（通常在设置中）
4. **检查样式优先级**: 使用开发者工具确认优化属性没有被其他样式覆盖

### 模态框显示异常（变形、模糊、位置错误）

如果模态框在白板缩放或平移后显示异常：

1. **检查 Teleport**: 确认所有模态框都使用 `<Teleport to="body">` 传送到 body
2. **检查定位**: 模态框应该使用 `position: fixed` 而不是 `absolute`
3. **检查父元素**: 确保模态框不在 `.wall-content` 内部
4. **参考现有实现**: 查看 Note.vue 中右键菜单、查看模态框的实现

### v-html 渲染的内容样式不生效

如果通过 `v-html` 渲染的内容（如 Markdown）样式不生效或被覆盖：

1. **检查 scoped 样式**: 相关样式是否在 `<style scoped>` 块中？如果是，移到非 scoped 的 `<style>` 块
2. **检查样式冲突**: 是否有其他 class 的样式覆盖？使用浏览器开发者工具检查实际应用的样式
3. **使用条件选择器**: 如 `.class-a:not(.class-b)` 来避免多个 class 时的样式冲突
4. **增加样式优先级**: 使用更具体的选择器或 `!important`（谨慎使用）
5. **硬刷新浏览器**: 使用 `Ctrl+Shift+R`（Windows/Linux）或 `Cmd+Shift+R`（Mac）清除缓存并刷新

### 依赖安装失败

如果在 `npm install` 时遇到错误：

1. 删除 `node_modules` 文件夹和 `package-lock.json`
2. 清除 npm 缓存：`npm cache clean --force`
3. 重新安装：`npm install`
4. 如果是网络问题，考虑使用国内镜像：`npm config set registry https://registry.npmmirror.com`

### AI生成功能不工作

如果点击"AI 生成内容"按钮后出现错误：

1. **检查模型配置**: 确认已在左侧边栏配置了模型（点击"模型管理 JSON"按钮）
2. **检查配置格式**: 确认 JSON 格式正确，包含必需字段（provider、apiBase、apiKey、models）
3. **查看错误信息**: 模态框底部会显示详细错误信息
4. **检查网络**: 确保服务器能访问配置的API地址
5. **API兼容性**: 如果使用第三方兼容服务，确认其API格式与OpenAI兼容

## 扩展项目指南

### 添加与白板相关的新功能

**创建新的白板级别功能**:

1. 在 `boards` 表中添加新字段（如颜色、图标、排序等）
   - 在 `backend/database.js` 的 `initDb()` 中添加字段迁移逻辑
   - 修改 `backend/routes/boards.js` 中的 API 以处理新字段
   - 更新 `frontend/src/App.vue` 中的白板列表管理
   - 更新 `frontend/src/components/NoteWall.vue` 中的白板配置显示

**示例：为白板添加颜色功能**

```javascript
// 1. 数据库迁移 (database.js)
db.run("ALTER TABLE boards ADD COLUMN color TEXT NOT NULL DEFAULT '#2196F3'");

// 2. 更新 boards API (routes/boards.js)
// 在创建和更新白板时处理 color 字段

// 3. 前端显示 (App.vue)
// 在标签栏显示白板颜色
<div :style="{ backgroundColor: board.color }"></div>
```

**修改 NoteWall.vue 以使用新的白板属性**:

1. 添加新的 prop：`boardColor: { type: String, default: '#2196F3' }`
2. 添加计算属性：`currentBoardColor() { return this.boardColor; }`
3. 在模板中使用：`:style="{ borderColor: currentBoardColor }"`
4. 确保通过 `@board-updated` 事件通知父组件更新

### 添加新的数据库字段

1. 在 `backend/database.js` 的 `initDb()` 函数中添加迁移逻辑（参考 `deleted_at` 字段的迁移方式）
2. 更新 `backend/routes/notes.js` 中的相关路由以处理新字段
3. 更新前端组件以支持新字段的显示和编辑

### 添加便签右键菜单功能

项目中实现了便签复制功能，可作为参考模式：

**1. Note.vue 中添加菜单项**:

```vue
<div class="context-menu-item" @click="copyNote">
  <span class="menu-icon">📋</span>
  <span>复制</span>
</div>
```

**2. Note.vue 中实现方法**:

```javascript
copyNote() {
  this.showContextMenu = false;

  // 触发复制事件，传递便签信息给父组件
  this.$emit('copy', {
    id: this.id,
    title: this.title,
    content: this.content,
    position_x: this.position_x,
    position_y: this.position_y
  });
}
```

**3. NoteWall.vue 中监听事件**:

```vue
<Note
  @copy="onNoteCopy"
  <!-- 其他 props 和事件 -->
/>
```

**4. NoteWall.vue 中实现处理方法**:

```javascript
async onNoteCopy(sourceNote) {
  try {
    const offsetX = 30;  // 水平偏移
    const offsetY = 30;  // 垂直偏移

    const response = await axios.post('/api/notes', {
      title: sourceNote.title,
      content: sourceNote.content,
      position_x: sourceNote.position_x + offsetX,
      position_y: sourceNote.position_y + offsetY,
      wall_id: this.boardId
    });

    this.notes.push(response.data.note);
    this.$emit('note-count-changed');
  } catch (error) {
    console.error('Failed to copy note:', error);
  }
}
```

**关键要点**:

- 使用 emit 事件模式进行子父组件通信
- 位置偏移避免新便签完全覆盖原便签
- 记得更新便签数量（触发 `note-count-changed` 事件）
- 调整右键菜单高度计算以适应新的菜单项数量

### 添加新的 API 路由

1. 在 `backend/routes/notes.js` 中添加新路由
2. **关键**: 将具体路径放在参数化路径（如 `/:id`）之前
3. 如果需要数据库支持，在 `backend/database.js` 的 `initDb()` 中添加表创建和迁移逻辑
4. 在前端组件中通过 axios 调用新路由
5. 更新 API 接口文档（上述 API 接口部分）

### 添加新的模态框

遵循项目的模态框模式：

1. **控制变量**: 添加 `showXxxModal` 布尔变量
2. **触发方法**: 设置控制变量为 `true`
3. **确认方法**: 执行操作并关闭模态框
4. **取消方法**: 仅关闭模态框
5. **点击外部关闭**: 使用 `@click` 和 `@click.stop` 实现
6. **使用 Teleport（重要）**: 如果在 Note.vue 中添加模态框，必须使用 `<Teleport to="body">` 传送到 body

示例：

```html
<!-- 在 Note.vue 中添加模态框 -->
<Teleport to="body">
  <div v-if="showXxxModal" class="modal-overlay" @click="cancelXxx">
    <div class="modal-content" @click.stop @wheel.stop>
      <!-- 内容（使用 @wheel.stop 防止滚动事件穿透到白板） -->
      <button @click="cancelXxx">取消</button>
      <button @click="confirmXxx">确认</button>
    </div>
  </div>
</Teleport>
```

**为什么必须使用 Teleport？**

- 白板使用 `transform: scale()` 进行缩放
- 如果模态框在 `.wall-content` 内，会继承缩放变换导致显示异常
- Teleport 将模态框传送到 body，完全脱离白板变换影响

### 修改 Markdown 渲染样式

1. 在 `Note.vue` 的非 scoped `<style>` 块中修改 `.markdown-body` 样式
2. 如需添加新的 Markdown 元素样式，在同一个非 scoped 块中添加
3. 确保 DOMPurify 的 `ALLOWED_TAGS` 包含新元素（如果需要）

### 实现类似的可视化连接功能

如果需要在项目中添加类似的元素间连接功能（如节点编辑器、流程图等），参考以下实现模式：

**1. 数据结构设计**:

```javascript
// 连接表包含源节点ID、目标节点ID和外键约束
FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE CASCADE
FOREIGN KEY (target_note_id) REFERENCES notes(id) ON DELETE CASCADE
UNIQUE(source_note_id, target_note_id)
```

**2. 前端渲染层**:

- 使用 SVG 或 Canvas 作为连接线层，设置 `pointer-events: none` 允许点击穿透
- 连接线使用 `pointer-events: stroke` 只在线条上响应点击
- 连接层放在元素下方（`z-index: 1`），元素在上方（`z-index: 10`）

**3. 动态位置计算**:

```javascript
// 给每个元素添加唯一标识，方便 DOM 查询
:data-element-id="id"

// 动态获取元素实际尺寸（注意：需要除以缩放比例）
const element = document.querySelector(`[data-element-id="${id}"]`);
const height = element.offsetHeight / viewport.scale;  // 考虑缩放

// 计算连接点位置（考虑元素的动态尺寸）
const x = elementX + width / 2;  // 水平居中
const y = elementY + height + offset;  // 垂直位置基于实际高度
```

**缩放和平移支持（重要）**:

- 如果容器支持缩放和平移，所有位置计算都必须使用坐标转换方法
- DOM 获取的尺寸（`offsetHeight`/`offsetWidth`）是屏幕空间值，需除以 `scale` 得到世界坐标值
- 连接线层应该在变换容器内部，随缩放平移一起变换

**4. 拖拽创建连接**:

- 使用全局 `mousemove` 和 `mouseup` 事件监听器
- 拖拽开始时获取连接点精确位置（使用 `getBoundingClientRect()`）
- 使用 `document.elementFromPoint()` 检测释放目标
- 通过状态标志（如 `isConnecting`）防止冲突操作

**5. 冲突处理**:

- 在拖拽开始时设置状态标志，禁用其他交互
- 在事件处理函数中检查状态标志
- 在 `mouseup` 时重置状态并移除事件监听器

### 实现框选功能

如果需要在项目中添加框选功能（如选区工具、批量操作等），参考以下实现模式：

**1. 状态管理**:

```javascript
// 框选状态对象
boxSelection: {
  isSelecting: false,    // 是否正在框选
  toggleMode: false,     // 是否为切换模式（Shift/Ctrl）
  startX: 0,             // 框选起始X（世界坐标）
  startY: 0,             // 框选起始Y（世界坐标）
  currentX: 0,           // 框选当前X（世界坐标）
  currentY: 0            // 框选当前Y（世界坐标）
},
selectedNoteIds: new Set(),  // 选中的便签ID集合
```

**2. 事件处理逻辑**:

```javascript
// 鼠标按下：开始框选
onWallMouseDown(event) {
  // 检查是否点击在便签上
  if (event.target.closest('.note')) return;

  // 检查是否按住 Shift/Ctrl（切换模式）
  const toggleMode = event.shiftKey || event.ctrlKey;

  // 记录起始位置（使用坐标转换）
  const startPos = this.screenToWorld(event.clientX, event.clientY);

  this.boxSelection = {
    isSelecting: true,
    toggleMode: toggleMode,
    startX: startPos.x,
    startY: startPos.y,
    currentX: startPos.x,
    currentY: startPos.y
  };

  // 如果不是切换模式，清空已有选择
  if (!toggleMode) {
    this.selectedNoteIds.clear();
  }
}

// 鼠标移动：更新框选区域
onWallMouseMove(event) {
  if (!this.boxSelection.isSelecting) return;

  // 更新当前坐标
  const currentPos = this.screenToWorld(event.clientX, event.clientY);
  this.boxSelection.currentX = currentPos.x;
  this.boxSelection.currentY = currentPos.y;

  // 检测框选内的便签
  this.updateBoxSelection();
}

// 鼠标松开：结束框选
onWallMouseUp() {
  if (this.boxSelection.isSelecting) {
    this.boxSelection.isSelecting = false;
  }
}
```

**3. 框选检测算法**:

```javascript
updateBoxSelection() {
  const { startX, startY, currentX, currentY } = this.boxSelection;

  // 计算框选矩形（标准化为左上角和右下角）
  const left = Math.min(startX, currentX);
  const right = Math.max(startX, currentX);
  const top = Math.min(startY, currentY);
  const bottom = Math.max(startY, currentY);

  // 遍历所有便签，检测是否在框内
  this.notes.forEach(note => {
    const noteLeft = note.position_x;
    const noteRight = note.position_x + NOTE_WIDTH;
    const noteTop = note.position_y;
    const noteBottom = note.position_y + NOTE_HEIGHT;

    // 检测矩形相交
    const isIntersecting = !(
      noteRight < left ||
      noteLeft > right ||
      noteBottom < top ||
      noteTop > bottom
    );

    if (isIntersecting) {
      this.selectedNoteIds.add(note.id);
    } else if (!this.boxSelection.toggleMode) {
      this.selectedNoteIds.delete(note.id);
    }
  });
}
```

**4. 视觉渲染**:

```css
/* 框选矩形样式 */
.selection-box {
  position: absolute;
  border: 2px solid rgba(59, 130, 246, 0.8);
  background-color: rgba(59, 130, 246, 0.1);
  pointer-events: none; /* 让鼠标事件穿透 */
  z-index: 100;
}

/* 选中便签样式 */
.note.selected {
  border: 3px solid #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
}
```

**5. 坐标转换（重要）**:

```javascript
// 屏幕坐标 → 世界坐标
screenToWorld(screenX, screenY) {
  const wallContent = this.$refs.wallContent;
  const rect = wallContent.getBoundingClientRect();

  return {
    x: (screenX - rect.left - this.viewport.translateX) / this.viewport.scale,
    y: (screenY - rect.top - this.viewport.translateY) / this.viewport.scale
  };
}
```

**关键要点**:

- 使用世界坐标系进行所有计算，避免缩放平移影响
- 框选矩形使用 `pointer-events: none` 避免干扰鼠标事件
- 切换模式允许用户追加选择，提升交互体验
- 使用 Set 数据结构维护选中状态，确保唯一性

### 实现多便签复制粘贴功能

项目支持框选多个便签后进行批量复制/剪切粘贴，并保持连接关系：

**数据结构设计:**

```javascript
// NoteWall.vue - 剪切板数据结构
clipboardData: {
  notes: [],           // 便签数组（包含相对位置偏移）
  connections: [],     // 连接线数组（只包含选中便签之间的连接）
  sourceWallId: null,  // 来源白板ID
  isCutMode: false,    // 剪切/复制模式
  baseNoteId: null,    // 基准便签ID（右键点击的便签）
  basePosition: { x: 0, y: 0 }  // 基准便签的原始位置
}
```

**实现要点:**

1. **基准点选择**: 右键点击触发复制/剪切的便签作为基准点（而不是第一个选中的便签）

   - 便于用户控制粘贴位置
   - 基准便签在粘贴时对准鼠标位置
2. **相对位置计算**: 每个便签存储相对于基准点的偏移量

   ```javascript
   // 复制时计算偏移
   offsetX = note.position_x - baseNote.position_x
   offsetY = note.position_y - baseNote.position_y

   // 粘贴时恢复位置
   pasteX = mouseX - 125;  // 基准便签对准鼠标（考虑便签宽度）
   pasteY = mouseY - 75;
   position_x = pasteX + noteData.offsetX
   position_y = pasteY + noteData.offsetY
   ```
3. **连接线处理**: 只复制选中便签之间的连接关系

   ```javascript
   // 筛选连接线
   const selectedNoteIdsSet = new Set(selectedNotes.map(n => n.id));
   const relatedConnections = this.connections.filter(conn =>
     selectedNoteIdsSet.has(conn.source_note_id) &&
     selectedNoteIdsSet.has(conn.target_note_id)
   );
   ```
4. **ID 映射**: 粘贴后新便签ID改变，需要更新连接线的 source_note_id 和 target_note_id

   ```javascript
   // 创建所有便签，记录 ID 映射
   const idMapping = {};
   for (const noteData of clipboardData.notes) {
     const response = await axios.post('/api/notes', {...});
     idMapping[noteData.id] = response.data.note.id;
   }

   // 使用映射后的 ID 创建连接线
   for (const conn of clipboardData.connections) {
     const newSourceId = idMapping[conn.source_note_id];
     const newTargetId = idMapping[conn.target_note_id];
     await axios.post('/api/notes/connections', {
       source_note_id: newSourceId,
       target_note_id: newTargetId
     });
   }
   ```
5. **剪切模式**: 剪切后粘贴一次性清空剪切板，复制模式可重复粘贴

   ```javascript
   if (this.clipboardData.isCutMode) {
     this.clipboardData = null;  // 剪切模式：一次性
   }
   // 复制模式：保留 clipboardData，可重复粘贴
   ```
6. **localStorage 持久化**: 剪切板数据保存在 localStorage，支持跨白板粘贴

**方法调用链:**

```
用户右键点击便签B → onNoteCopy(noteB)
  → 检测 selectedNoteIds.size > 1
  → copyMultipleNotes(noteB)  // 传入右键点击的便签作为基准
    → 计算偏移量、筛选连接线
    → 保存到 clipboardData 和 localStorage
```

**粘贴流程:**

```
用户右键白板粘贴 → pasteNote()
  → 从 clipboardData 读取数据
  → 计算鼠标位置作为粘贴点
  → 批量创建便签（ID映射）
  → 批量创建连接线（使用映射后的ID）
  → 根据模式决定是否清空剪切板
```

**关键文件位置:**

- NoteWall.vue:869 - `onNoteCopy()` 复制入口
- NoteWall.vue:893 - `onNoteCut()` 剪切入口
- NoteWall.vue:931 - `copyMultipleNotes(baseNote)` 多便签复制
- NoteWall.vue:964 - `cutMultipleNotes(baseNote)` 多便签剪切
- NoteWall.vue:1060 - `pasteNote()` 粘贴方法
- NoteWall.vue:1139 - `loadClipboardFromStorage()` 加载剪切板
- NoteWall.vue:1150 - `saveClipboardToStorage()` 保存剪切板

**使用场景:**

- 框选多个相关便签后复制到另一个位置
- 框选多个便签后剪切粘贴到另一个白板
- 保持便签之间的相对位置和连接关系

### 实现便签索引和搜索功能

项目实现了右侧便签索引面板，方便用户快速查找和跳转到便签：

**功能说明:**

- **便签列表**: 显示当前白板的所有便签（按创建时间倒序）
- **实时搜索**: 输入关键词实时过滤便签标题
- **相对时间**: 显示便签创建时间的相对格式（如"3分钟前"、"2小时前"）
- **快速跳转**: 点击便签项自动跳转到对应位置

**实现要点:**

1. **数据流**: NoteWall 通过 `@notes-loaded` 事件将便签列表传递给 App.vue
2. **搜索过滤**: 使用 computed 属性 `sortedNotes` 实时过滤和排序
3. **时间格式化**: `formatNoteTime()` 方法将时间转换为相对格式
4. **位置跳转**: 通过 `jumpToNote(note)` 方法调用 NoteWall 的跳转功能

**关键文件位置:**

- App.vue:102-143 - 右侧边栏模板
- App.vue:285-306 - `sortedNotes` 计算属性
- App.vue:646-717 - 右侧边栏相关方法
- NoteWall.vue:2020-2065 - `jumpToNote()` 方法实现

**跳转功能实现细节:**

```javascript
jumpToNote(note) {
  // 1. 获取便签元素的实际尺寸（考虑缩放）
  const noteElement = document.querySelector(`.note[data-note-id="${note.id}"]`);
  const noteHeight = noteElement.offsetHeight / this.viewport.scale;
  const noteWidth = noteElement.offsetWidth / this.viewport.scale;

  // 2. 计算便签中心的世界坐标
  const noteCenterX = note.position_x + noteWidth / 2;
  const noteCenterY = note.position_y + noteHeight / 2;

  // 3. 计算目标平移量，使便签位于屏幕中心
  const screenCenterX = window.innerWidth / 2;
  const screenCenterY = window.innerHeight / 2;

  this.viewport.translateX = screenCenterX - noteCenterX * this.viewport.scale;
  this.viewport.translateY = screenCenterY - noteCenterY * this.viewport.scale;

  // 4. 添加动画效果
  this.$refs.wallContent.classList.add('animating');
  setTimeout(() => {
    this.$refs.wallContent.classList.remove('animating');
  }, 300);
}
```

### 实现白板拖拽排序功能

项目使用 vuedraggable 组件实现白板拖拽排序：

**功能说明:**

- 拖拽白板项调整顺序
- 拖拽过程中显示视觉效果
- 拖拽结束后自动保存到后端

**实现要点:**

1. **组件引入**: 在 App.vue 中引入 vuedraggable
2. **数据绑定**: `v-model="boards"` 双向绑定白板列表
3. **拖拽配置**:
   - `item-key="id"` - 指定唯一标识
   - `:disabled="sidebarCollapsed"` - 收起时禁用拖拽
   - `@end="onDragEnd"` - 拖拽结束事件
4. **后端保存**: 拖拽结束后调用 `PUT /api/notes/boards/reorder` 保存排序

**关键文件位置:**

- App.vue:12-57 - vuedraggable 组件配置
- App.vue:451-467 - `onDragEnd()` 方法
- backend/routes/boards.js - 排序 API 实现

### 模型配置的掩码处理

项目实现了 API Key 的安全掩码处理：

**掩码逻辑:**

- 保留前 3 个字符和后 4 个字符
- 中间部分替换为 `***...`
- 示例: `sk-abc123def456` → `sk-***...ef456`

**保存逻辑:**

1. **检测掩码**: 检查 apiKey 是否包含 `***`
2. **保持原值**: 如果是掩码且存在对应记录，保持原值（`_keepOriginalKey: true`）
3. **更新密钥**: 如果不是掩码或新记录，保存新值（`_keepOriginalKey: false`）
4. **删除厂商**: 删除用户移除的厂商配置

**关键文件位置:**

- backend/routes/model-config.js:5-11 - `maskApiKey()` 函数
- backend/routes/model-config.js:35-120 - 保存逻辑
- App.vue:554-630 - 前端掩码处理逻辑

### 调试技巧

1. 使用 VS Code 的调试配置（`.vscode/launch.json`）进行断点调试
2. 前端：在组件方法中添加 `debugger` 语句或使用 Vue DevTools
3. 后端：使用 `console.log()` 或 VS Code 的 Node.js 调试器
4. 数据库：使用 `sqlite3 notes.db` 命令行工具查询数据
5. 网络请求：使用浏览器开发者工具的 Network 面板查看 API 请求

### 测试 API

项目不包含自动化测试，但可以通过以下方式手动测试 API：

**使用 curl 测试后端:**

```bash
# 健康检查
curl http://localhost:3001/api/health

# 创建便签
curl -X POST http://localhost:3001/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"测试标题","content":"测试内容","position_x":100,"position_y":100}'

# 获取所有便签
curl http://localhost:3001/api/notes

# 更新便签
curl -X PUT http://localhost:3001/api/notes/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"更新标题","content":"更新内容","position_x":200,"position_y":200}'

# 软删除便签
curl -X DELETE http://localhost:3001/api/notes/1

# 恢复便签
curl -X POST http://localhost:3001/api/notes/recycle-bin/restore/1

# 创建连接
curl -X POST http://localhost:3001/api/notes/connections \
  -H "Content-Type: application/json" \
  -d '{"source_note_id": 1, "target_note_id": 2}'

# 获取所有连接
curl http://localhost:3001/api/notes/connections

# 删除连接
curl -X DELETE http://localhost:3001/api/notes/connections/1

# AI生成内容（需要先在侧边栏配置模型）
curl -X POST http://localhost:3001/api/notes/ai-generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"写一篇关于Vue的文章"}'
```

**使用浏览器开发者工具:**

1. 打开浏览器开发者工具（F12）
2. 切换到 Console 面板
3. 使用 `fetch` API 测试：

```javascript
// 获取所有便签
fetch('/api/notes')
  .then(res => res.json())
  .then(data => console.log(data));

// 创建新便签
fetch('/api/notes', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    title: '新便签',
    content: '便签内容',
    position_x: 100,
    position_y: 100
  })
})
.then(res => res.json())
.then(data => console.log(data));

// AI生成内容（需要先在侧边栏配置模型）
fetch('/api/notes/ai-generate', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    prompt: '写一篇关于Vue的文章'
  })
})
.then(res => res.json())
.then(data => console.log(data));
```
