根据代码,我来为你介绍前端的DOM结构:

  整体层次结构
```
  App.vue (#app)
    └── NoteWall.vue (.note-wall)
```
  NoteWall.vue 的详细结构
```
  .note-wall (主容器,全屏)
  │
  ├── .title-container (固定标题容器)
  │   └── .wall-title (标题,双击可编辑)
  │       └── .tooltip (备注提示)
  │
  ├── .wall-content (白板内容变换层,应用缩放平移)
  │   │
  │   ├── .boundary-lines (白板边界线)
  │   │   ├── .boundary-line.boundary-top (顶部边界)
  │   │   ├── .boundary-line.boundary-left (左侧边界)
  │   │   └── .boundary-corner (0,0标记)
  │   │
  │   ├── svg.connections-layer (SVG连线层)
  │   │   ├── line.connection-line (连接线)
  │   │   ├── polygon.connection-arrowhead (箭头)
  │   │   └── line.temp-connection-line (拖拽中的临时线)
  │   │
  │   └── Note (便签组件,多个)
  │       ├── .connection-point.input-point (引入点,上中心)
  │       ├── .note-content (便签内容)
  │       │   ├── .note-title (标题)
  │       │   └── .note-text (内容)
  │       └── .connection-point.output-point (引出点,下中心)
  │
  ├── button.add-button (添加按钮,右下角)
  ├── button.recycle-button (回收站按钮,左下角)
  ├── .zoom-controls (缩放控制,右下角)
  │   ├── button.zoom-btn (+ 放大)
  │   ├── button.zoom-btn (- 缩小)
  │   ├── button.zoom-btn.reset (⟲ 重置)
  │   └── .zoom-level (显示缩放比例)
  │
  └── 模态框组:
      ├── .recycle-modal (回收站模态框)
      ├── .modal-overlay (编辑标题模态框)
      ├── .modal-overlay.confirm-modal-overlay (永久删除确认)
      └── .modal-overlay.confirm-modal-overlay (清空回收站确认)
```
  Note.vue 的内部结构

  每个便签组件包含:
```
  .note (便签容器,绝对定位)
  │
  ├── .connection-point.input-point (引入点)
  │   └── .point-inner
  │
  ├── .note-content (双击打开查看)
  │   ├── .note-title (标题)
  │   └── .note-text (内容摘要)
  │
  ├── .connection-point.output-point (引出点)
  │   └── .point-inner
  │
  ├── .context-menu (右键菜单,条件显示)
  │   ├── .context-menu-item (编辑)
  │   └── .context-menu-item.danger (删除)
  │
  ├── .edit-modal (编辑模态框,条件显示)
  │   └── .edit-modal-content
  │       ├── .edit-header
  │       ├── .edit-body
  │       │   ├── input.edit-title
  │       │   └── textarea.edit-content
  │       └── .edit-footer
  │
  └── .view-modal (查看模态框,条件显示)
      └── .view-modal-content
          ├── .view-header
          └── .view-body
              └── .view-content.markdown-body (支持Markdown)
```
  关键布局特点

  1. 固定元素 (不受缩放平移影响):
    - .title-container - 顶部居中
    - .add-button - 右下角
    - .recycle-button - 左下角
    - .zoom-controls - 右下角
  2. 变换层 (支持缩放平移):
    - .wall-content - 使用 CSS transform: translate() scale()
    - 内部所有便签、连线、边界线都随此层变换
  3. z-index 层级:
    - 边界线: 0
    - 连接线层: 1
    - 便签: 默认 (高于连线层)
    - 固定按钮: 1000
    - 标题: 1001
    - 模态框: 1002 / 2000 / 2001
  4. 事件处理:
    - .note-wall: 监听拖拽、滚轮缩放
    - .note: 便签拖拽 (HTML5 Drag & Drop)
    - .connection-point: 连接线创建
    - .connection-line: 点击选中连接

  这个DOM结构设计使得白板可以支持缩放平移操作,同时保持UI固定元素不受影响。