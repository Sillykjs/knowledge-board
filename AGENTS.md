# AGENTS.md

This file contains guidelines for agentic coding agents working in this Knowledge Board (知识白板) repository.

## Development Commands

### Frontend (Vue 3 + Vite)
```bash
cd frontend
npm install                    # Install dependencies
npm run dev                    # Start development server (port 5173)
npm run build                  # Build for production
npm run preview                # Preview production build
```

### Backend (Express.js + SQLite)
```bash
cd backend
npm install                    # Install dependencies
npm run dev                    # Start development server with nodemon (port 3001)
npm start                      # Start production server
```

### VS Code Debug Configuration (Recommended)
- Use "启动全部 (Full Stack)" configuration to start both frontend and backend
- Individual configs available: "启动后端 (Backend)" and "启动前端 (Frontend)"

## Project Architecture

### Stack
- **Frontend**: Vue 3 (Options API) + Vite + Vditor (Markdown editor)
- **Backend**: Express.js + SQLite3
- **Database**: SQLite file at `backend/notes.db`

### Key Directories
```
ChatBranch2/
├── backend/                 # Express.js backend
│   ├── server.js           # Main entry point
│   ├── database.js         # SQLite setup and migrations
│   └── routes/             # API handlers
└── frontend/               # Vue 3 frontend
    ├── src/
    │   ├── App.vue        # Main app layout
    │   ├── components/    # Vue components
    │   └── utils/         # Utility functions
    └── vite.config.js
```

## Code Style Guidelines

### Vue Components
- **Use Options API, not Composition API** (existing codebase convention)
- File naming: PascalCase for components (e.g., `NoteWall.vue`)
- Component props: Define as array with type validation when needed
- Data properties: Use camelCase, return objects from `data()` function
- Methods: Use camelCase, bind to component context automatically

```javascript
// Correct pattern
export default {
  name: 'NoteWall',
  data() {
    return {
      notes: [],
      scale: 1.0
    }
  },
  methods: {
    addNote() {
      // implementation
    }
  }
}
```

### State Management
- Vue 3 reactivity requires direct mutation or reassignment
- For arrays: `this.array = [...newArray]` to trigger reactivity
- For objects: `this.object = { ...this.object, newProp: value }`

### Coordinate System
- **World coordinates**: Absolute positions stored in database
- **Screen coordinates**: Transformed positions based on viewport
- Conversion utilities in `NoteWall.vue`: `screenToWorld()` and `worldToScreen()`

### Backend API
- RESTful endpoints under `/api/`
- Use async/await for database operations
- Error handling: Send appropriate HTTP status codes with JSON responses
- Database operations use SQLite3 prepared statements

```javascript
// Example API pattern
app.get('/api/notes', async (req, res) => {
  try {
    const { wall_id } = req.query;
    const notes = await db.all(
      'SELECT * FROM notes WHERE wall_id = ? AND deleted_at IS NULL',
      [wall_id]
    );
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Import Style
- Use relative imports for internal modules
- Place imports at top of file
- Group imports: third-party libraries first, then internal modules

```javascript
// Backend
const express = require('express');
const router = express.Router();
const db = require('../database');

// Frontend
import axios from 'axios';
import Note from './Note.vue';
```

### Error Handling
- Frontend: Use try/catch for async operations, show user-friendly messages
- Backend: Use error middleware pattern, log errors for debugging
- Database: Wrap SQL operations in try/catch, handle connection errors

### Naming Conventions
- **Variables**: camelCase
- **Functions**: camelCase, descriptive verbs
- **Classes/Components**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Database tables**: snake_case
- **API endpoints**: kebab-case with plural nouns

### Database Operations
- Always use prepared statements to prevent SQL injection
- Soft delete pattern: use `deleted_at` timestamp instead of DELETE
- Use transactions for multi-table operations
- Migration pattern: Check column existence with `PRAGMA table_info()`

### CSS Guidelines
- Use scoped styles in Vue components
- BEM-like naming for utility classes
- Responsive design: prefer flexbox/grid over fixed positioning
- CSS variables for theme consistency

```css
.note-wall {
  position: relative;
  overflow: hidden;
}

.note {
  position: absolute;
  background: white;
  border-radius: 8px;
}
```

## Important Patterns

### Canvas Interactions
- Mouse events need coordinate transformation
- Drag operations track state in component data
- Use event delegation for performance with many elements

### Markdown Content
- Store raw Markdown in database
- Render with Vditor, sanitize with DOMPurify
- Stream support for AI-generated content

### Multi-Board Architecture
- Each board isolated by `wall_id`
- Board metadata includes `system_prompt` for AI context
- Viewport state saved per board

## Testing Notes
- No automated test framework currently configured
- Manual testing required for new features
- Test with different data sizes for performance validation

## AI Integration
- Model configurations stored in `model_configs` table
- API keys masked in UI, preserved in database
- Context tracing uses BFS on connection graph
- Use board's `system_prompt` + connected notes as context