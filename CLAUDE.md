# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Knowledge Board (知识白板) is a structured AI chat system that uses an infinite canvas to organize knowledge through notes and connections. Each note represents an AI interaction (title as question, content as AI response), and connections define context relationships between notes.

**Key Concept**: Unlike traditional linear chat, this system allows non-linear knowledge organization where notes can have multiple upstream dependencies and multiple downstream references, with BFS-based context tracing along connections.

## Development Commands

### Backend (Express.js + SQLite)
```bash
cd backend
npm install                    # Install dependencies
npm run dev                    # Start with nodemon (port 3001)
npm start                      # Start production server
```

### Frontend (Vue 3 + Vite)
```bash
cd frontend
npm install                    # Install dependencies
npm run dev                    # Start dev server (port 5173)
npm run build                  # Build for production
npm run preview                # Preview production build
```

### VS Code Debug Configuration
Use "启动全部 (Full Stack)" to start both frontend and backend simultaneously.

## Architecture

### Tech Stack
- **Frontend**: Vue 3 (Options API), Vite, Vditor (Markdown editor), DOMPurify, KaTeX
- **Backend**: Express.js, SQLite3, axios
- **Database**: SQLite file at `backend/notes.db`

### Directory Structure
```
knowledge-board/
├── backend/
│   ├── server.js           # Express entry point
│   ├── database.js         # SQLite setup and migrations
│   └── routes/
│       ├── notes.js        # Notes & connections API
│       ├── boards.js       # Multi-board management
│       └── model-config.js # AI model configuration
└── frontend/
    └── src/
        ├── App.vue         # Main layout, board switching, model config
        ├── components/
        │   ├── NoteWall.vue    # Infinite canvas, notes rendering
        │   ├── Note.vue        # Individual note component
        │   ├── ChatModal.vue   # Chat interface for AI generation
        │   └── VditorEditor.vue # Markdown editor wrapper
        └── utils/
            └── coordinate.js    # World/screen coordinate conversion
```

### Database Schema

**boards**: `id, title, system_prompt, created_at, updated_at, sort_order`
- Each board has independent system_prompt for AI context
- sort_order controls sidebar display order

**notes**: `id, title, content, position_x, position_y, wall_id, created_at, updated_at, deleted_at`
- wall_id links to boards (default=1)
- Soft delete via deleted_at timestamp

**note_connections**: `id, source_note_id, target_note_id, wall_id, created_at`
- Directed edges: source -> target
- BFS traces upstream for context

**model_configs**: `id, provider, api_base, api_key, models, sort_order`
- Supports multiple AI providers (OpenAI, DeepSeek, etc.)
- API keys masked in UI (***), preserved in DB

### Coordinate System
- **World coordinates**: Absolute positions stored in database (position_x, position_y)
- **Screen coordinates**: Transformed positions based on viewport (scale, translateX, translateY)
- Conversion utilities in `NoteWall.vue`: `screenToWorld()` and `worldToScreen()`

### Key Features

**Multi-Board Support**: Each board has independent notes, connections, and system_prompt. Viewport state (scale, position) is preserved per board.

**Context Tracing**: Uses BFS to traverse connections upstream, building multi-turn conversation history. Each note becomes a user/assistant pair (title=question, content=answer).

**AI Generation**: Streaming SSE responses, supports reasoning models (o1, glm-4.7) with separate reasoning content display.

**Recycle Bin**: Soft-delete pattern with restore/permanent delete options.

## Code Conventions

### Vue Components
- **Use Options API** (not Composition API) - existing codebase convention
- File naming: PascalCase (e.g., `NoteWall.vue`)
- Data properties: camelCase, return objects from `data()` function
- Methods: camelCase

### Vue Reactivity
```javascript
// For arrays: create new reference to trigger updates
this.notes = [...newNotes];

// For objects: spread for new reference
this.object = { ...this.object, newProp: value };
```

### Backend API
- RESTful endpoints under `/api/`
- Always use prepared statements to prevent SQL injection
- Soft delete pattern: set `deleted_at` instead of DELETE
- Error handling: Send appropriate HTTP status codes with JSON responses

```javascript
app.get('/api/notes', async (req, res) => {
  try {
    const notes = await db.all('SELECT * FROM notes WHERE wall_id = ?', [wallId]);
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Naming Conventions
- **Variables/Functions**: camelCase
- **Components/Classes**: PascalCase
- **Database tables/columns**: snake_case
- **API endpoints**: kebab-case with plural nouns

### Markdown & HTML Security
- Store raw Markdown in database
- Render with Vditor, sanitize with DOMPurify
- Safe HTML tags allowed in chat messages

### AI Integration Notes
- Model configs stored in `model_configs` table
- API keys masked in UI (show only last 4 chars)
- Context tracing uses BFS on connection graph (max 24 levels)
- Reasoning models: detect by model name prefix (o1, glm-4.7)

## Important Patterns

### Board Switching
When switching boards:
1. Save current viewport state to `boardViewports[currentBoardId]`
2. Update `currentBoardId`
3. Restore viewport from saved state
4. Reload notes for new board

### Connection Creation
Connections are always created from source_note_id to target_note_id. The wall_id is inherited from the source note unless explicitly provided.

### AI Context Building
For context tracing (BFS):
1. Start from note_id
2. Find all parent notes (connections where this note is target)
3. Continue up to context_level (1-24)
4. Build messages array: [system_prompt, ...context_pairs, current_prompt]
5. Each context note = user(title) + assistant(content)

### Route Definition Order
Important: More specific routes must be defined before parameterized routes:
```javascript
// /connections before /:id
router.get('/connections', ...);
router.delete('/connections/:connectionId', ...);

// /recycle-bin before /:id
router.get('/recycle-bin', ...);

// /ai-generate before /:id
router.post('/ai-generate', ...);

// General routes
router.get('/', ...);
router.post('/', ...);
router.put('/:id', ...);
router.delete('/:id', ...);
```

### Model Configuration Pattern
- When editing: if apiKey contains `***`, keep original in DB
- When saving: match by provider to update existing or insert new
- Missing providers in user's JSON are deleted from DB
