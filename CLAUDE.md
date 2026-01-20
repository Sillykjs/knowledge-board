# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Knowledge Board (知识白板) is a full-stack application that combines an infinite canvas whiteboard with AI chat capabilities. Users can create AI-generated notes as sticky notes on an infinite whiteboard, connect them with lines, and build knowledge networks.

**Tech Stack:**

- **Frontend**: Vue 3 + Vite + Vditor (Markdown editor)
- **Backend**: Express.js + SQLite3
- **Database**: SQLite (file: `backend/notes.db`)

## Development Commands

### Running the Application

**Recommended: Use VS Code Debug Configuration**

1. Open VS Code
2. Select "启动全部 (Full Stack)" from the debug dropdown
3. Press F5 to start both frontend and backend

**Or use command line:**

```bash
# Terminal 1: Start backend (port 3001)
cd backend
npm run dev          # Uses nodemon for auto-reload

# Terminal 2: Start frontend (port 5173)
cd frontend
npm run dev
```

**Other commands:**

```bash
# Backend
cd backend
npm start            # Production mode (no auto-reload)

# Frontend
cd frontend
npm run build        # Build for production
npm run preview      # Preview production build
```

### Installing Dependencies

```bash
cd backend && npm install
cd frontend && npm install
```

## Architecture

### Project Structure

```
ChatBranch2/
├── backend/                 # Express.js backend
│   ├── server.js           # Main entry point
│   ├── database.js         # SQLite database initialization & migrations
│   ├── routes/             # API route handlers
│   │   ├── notes.js        # Notes & connections CRUD
│   │   ├── boards.js       # Boards (whiteboards) management
│   │   └── model-config.js # AI model configuration
│   └── notes.db            # SQLite database (auto-created)
│
├── frontend/               # Vue 3 frontend
│   ├── src/
│   │   ├── App.vue        # Main app (board sidebar, modals, layout)
│   │   ├── components/
│   │   │   ├── NoteWall.vue   # Infinite canvas (zoom, pan, connections)
│   │   │   ├── Note.vue       # Individual note component
│   │   │   └── VditorEditor.vue # Markdown editor wrapper
│   │   └── utils/
│   │       └── vditorConfig.js # Vditor configuration
│   └── index.html
│
└── .vscode/launch.json     # VS Code debug configurations
```

### Database Schema

**Core tables:**

- `boards`: Whiteboard configurations (id, title, system_prompt, sort_order)
- `notes`: Sticky notes (id, title, content, position_x, position_y, wall_id, deleted_at)
- `note_connections`: Connections between notes (source_note_id, target_note_id, wall_id)
- `model_configs`: AI model configurations (provider, api_base, api_key, models, sort_order)

**Key relationships:**

- Each note belongs to one board (`wall_id`)
- Notes can be soft-deleted (`deleted_at` timestamp)
- Connections link notes directionally (source → target)
- Cascade delete: when a note is deleted, its connections are removed

### Coordinate System

The whiteboard uses an infinite canvas with:

- **World coordinates**: Absolute positions on the canvas (stored in database)
- **Screen coordinates**: Transformed positions based on viewport (scale + translation)
- **Viewport state**: `{ scale, translateX, translateY }` stored in `NoteWall.vue`
- Conversion utilities in `NoteWall.vue`: `screenToWorld()` and `worldToScreen()`

### Key Data Flow

1. **Note creation**: User clicks "+" → `NoteWall.addNote()` → POST `/api/notes` → creates note with current viewport center position
2. **Note positioning**: User drags note → `Note.vue` emits drag events → `NoteWall` updates world coordinates → PUT `/api/notes/:id`
3. **Connection creation**: User drags from connection handle → `NoteWall` tracks drag state → on release → POST `/api/notes/connections`
4. **Context tracing**: Right-click note → "上文追溯" → BFS traversal of connection graph → highlight upstream notes
5. **AI generation**: User opens note → clicks "AI 生成内容" → loads context from connected notes → calls configured AI model → streams response → saves to note

### State Management

- **App.vue**: Manages board list, model config, right sidebar (note index), search query
- **NoteWall.vue**: Manages viewport state, notes list, connections, selection state, drag operations
- **Note.vue**: Manages individual note editing, Markdown rendering, connection handle interactions
- **Board viewport persistence**: Each board's viewport state is saved when switching boards

### Multi-Board Architecture

- Each board is isolated (notes have `wall_id`)
- Sidebar shows draggable board list with note counts
- Board metadata includes `system_prompt` used for AI generation
- Boards can be reordered (drag & drop) → saves `sort_order` to database

### AI Model Configuration

- Models configured via "模型管理 JSON" modal (stored in `model_configs` table)
- Supports multiple providers (OpenAI, DeepSeek, etc.)
- API keys are masked in UI (***hidden***) but preserved in database
- Model selection stored in localStorage as `lastUsedModel` (format: "provider|model")
- When AI generates content, it uses the board's `system_prompt` + context from connected notes

## Important Patterns

### Vue Reactivity

- Vue 3 Composition API is NOT used; components use Options API
- State updates require direct mutation or reassignment
- When updating arrays, use `this.array = [...newArray]` to trigger reactivity

### Coordinate Transformations

All canvas interactions must convert between screen and world coordinates:

```javascript
// Screen → World (for creating/moving items)
worldX = (screenX - translateX) / scale
worldY = (screenY - translateY) / scale

// World → Screen (for rendering items)
screenX = worldX * scale + translateX
screenY = worldY * scale + translateY
```

### Connection Graph Traversal

Context tracing uses BFS (Breadth-First Search) to find upstream notes:

- Start from target note, follow connections backwards
- Track visited notes to avoid cycles
- Limit depth by `contextLevel` (1-24 layers)
- Highlight matching notes and connections

### Markdown Rendering

- Vditor used for both editing and rendering
- Content stored as raw Markdown in database
- Sanitized with DOMPurify to prevent XSS
- Stream rendering support for AI responses

### Soft Deletion

- Notes are soft-deleted (set `deleted_at` timestamp)
- API queries filter out `deleted_at IS NULL`
- Recycle bin feature allows restoration
- Connections are cascade-deleted when source/target note is deleted

## API Endpoints

### Boards (`/api/notes/boards`)

- `GET /api/notes/boards` - List all boards with note counts
- `POST /api/notes/boards` - Create new board
- `PUT /api/notes/boards/:id` - Update board (title, system_prompt)
- `DELETE /api/notes/boards/:id` - Delete board and all its notes/connections
- `PUT /api/notes/boards/reorder` - Reorder boards (drag & drop)

### Notes (`/api/notes`)

- `GET /api/notes?wall_id=N` - Get notes for a board
- `POST /api/notes` - Create note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Soft-delete note
- `POST /api/notes/:id/restore` - Restore deleted note
- `POST /api/notes/:id/generate` - Generate AI content (streams response)

### Connections (`/api/notes/connections`)

- `GET /api/notes/connections?wall_id=N` - Get connections for a board
- `POST /api/notes/connections` - Create connection
- `DELETE /api/notes/connections/:connectionId` - Delete connection
- `GET /api/notes/connections/:noteId/upstream?depth=N` - Get upstream context

### Model Config (`/api/model-config`)

- `GET /api/model-config` - Get all model configs (with masked API keys)
- `POST /api/model-config` - Save model configs (handles masked keys)
- `DELETE /api/model-config` - Delete model configs (body: `{ ids: [...] }`)

## Common Tasks

### Adding a New API Endpoint

1. Create route handler in `backend/routes/` (e.g., `notes.js` or new file)
2. Import and mount router in `backend/server.js`: `app.use('/api/feature', featureRouter)`
3. Access from frontend using axios: `axios.get('/api/feature/...')`

### Modifying Database Schema

1. Add migration function in `backend/database.js` (see existing `migrate*()` functions)
2. Call migration from `initDb()` function
3. Migration pattern: Check column existence with `PRAGMA table_info()`, then `ALTER TABLE` if needed

### Adding UI Components

- Place in `frontend/src/components/`
- Import and use in parent component (App.vue, NoteWall.vue, or Note.vue)
- Use ` Teleport to="body"` for modals
- Follow existing styling patterns (CSS classes in `<style>` block)

### Debugging Canvas Coordinates

- Origin crosshair marks (0, 0) in world coordinates
- Use browser DevTools to inspect note positions
- Viewport state visible in NoteWall component data
- Check that drag events use correct coordinate system

## Testing AI Features

To test AI generation without a real API key:

1. Use the "模型管理 JSON" button in the sidebar
2. Configure a mock provider (e.g., OpenAI with a test endpoint)
3. Or use environment variables for API keys (not currently implemented)

## Known Constraints

- No authentication/user system (single-user application)
- No real-time collaboration
- Database is SQLite (not suitable for high-concurrency scenarios)
- No automated tests (manual testing required)
- Chinese language UI (hardcoded Chinese strings)
