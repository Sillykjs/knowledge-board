# Note Wall Application

## Project Overview

The Note Wall application is a full-stack web application that allows users to create, edit, and organize digital sticky notes on a virtual wall. The application features a drag-and-drop interface where users can position notes freely, edit their content, and manage them through a clean and intuitive UI.

### Architecture

- **Frontend**: Vue 3 application built with Vite, featuring a responsive drag-and-drop interface
- **Backend**: Node.js/Express API with SQLite database for data persistence
- **Communication**: RESTful API with JSON data exchange

### Features

- Create, read, update, and delete sticky notes
- Drag-and-drop positioning of notes on the wall
- Real-time editing of note titles and content
- Responsive grid background for positioning reference
- Confirmation dialogs for destructive actions
- Soft deletion mechanism with a recycle bin
- Markdown rendering support for note content
- Customizable wall title and remark
- Right-click context menus for note operations

## Project Structure

```
├── backend/                 # Node.js/Express backend
│   ├── server.js           # Main server file
│   ├── database.js         # SQLite database configuration
│   ├── routes/
│   │   └── notes.js        # Notes API routes (with recycle bin functionality)
│   └── package.json        # Backend dependencies
└── frontend/               # Vue 3 frontend
    ├── src/
    │   ├── App.vue         # Main application component
    │   ├── components/
    │   │   ├── NoteWall.vue # Main wall component
    │   │   └── Note.vue     # Individual note component
    │   └── main.js         # Vue application entry point
    ├── index.html          # HTML template
    ├── vite.config.js      # Vite configuration with API proxy
    └── package.json        # Frontend dependencies
```

## API Endpoints

The backend provides the following RESTful API endpoints:

### Note Operations
- `GET /api/notes` - Retrieve all active notes (not soft-deleted)
- `POST /api/notes` - Create a new note
- `PUT /api/notes/:id` - Update an existing note
- `DELETE /api/notes/:id` - Soft delete a note (moves to recycle bin)

### Recycle Bin Operations
- `GET /api/notes/recycle-bin` - Retrieve all soft-deleted notes
- `POST /api/notes/recycle-bin/restore/:id` - Restore a note from recycle bin
- `DELETE /api/notes/recycle-bin/:id` - Permanently delete a note from recycle bin
- `DELETE /api/notes/recycle-bin` - Empty the entire recycle bin

### Wall Configuration
- `GET /api/notes/config` - Get wall title and remark
- `PUT /api/notes/config` - Update wall title and remark
- `GET /api/health` - Health check endpoint

## Database Schema

The application uses SQLite with two tables:

### Notes Table
```sql
CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL  -- Used for soft deletion
);
```

### Wall Config Table
```sql
CREATE TABLE wall_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  title TEXT NOT NULL DEFAULT '便签墙',
  remark TEXT NOT NULL DEFAULT '这是便签墙的备注信息',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Building and Running

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the backend server:
   ```bash
   # For development with auto-restart
   npm run dev
   
   # For production
   npm start
   ```

The backend server will run on `http://localhost:3001`.

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:5173` and will automatically proxy API requests to the backend.

### Full Development Setup

To run both frontend and backend simultaneously:

1. Start the backend in one terminal:
   ```bash
   cd backend && npm run dev
   ```

2. In another terminal, start the frontend:
   ```bash
   cd frontend && npm run dev
   ```

The application will be accessible at `http://localhost:5173`.

## Development Conventions

### Frontend
- Vue 3 with Options API
- Component-based architecture
- Axios for API communication
- CSS with scoped styles (except for markdown styles which are global)
- Responsive design with grid background
- Markdown-it for parsing markdown content
- DOMPurify for sanitizing HTML content

### Backend
- Express.js for routing
- SQLite for data persistence
- RESTful API design
- Error handling with appropriate HTTP status codes
- Input validation for required fields
- Soft deletion mechanism for notes

### Code Style
- JavaScript ES6+ syntax
- Consistent indentation (2 spaces)
- Descriptive variable and function names
- Proper error handling and logging
- API responses follow consistent JSON structure

### Soft Deletion Mechanism
- Notes are not permanently deleted immediately
- Instead, they are marked with a `deleted_at` timestamp
- A recycle bin feature allows users to view and restore deleted notes
- Only when explicitly requested are notes permanently removed from the database

### Markdown Rendering
- Notes support Markdown syntax for rich text formatting
- Markdown is rendered only in the read-only view modal (opened with double-click)
- Editing is done in plain text format
- HTML output is sanitized using DOMPurify to prevent XSS attacks

## Key Implementation Details

### Drag and Drop
- Native HTML5 Drag & Drop API is used for moving notes
- Position updates are sent to the backend when dragging ends
- Dragging is disabled when modals are open

### Context Menus
- Right-click on notes opens a context menu with edit/delete options
- Menu positions are calculated to stay within viewport boundaries

### Modals
- Separate modals for editing and viewing notes
- Confirmation modals for destructive actions (permanent deletion, emptying recycle bin)
- Clicking outside modals closes them appropriately

### Data Flow
- NoteWall component manages the state of all notes
- Child Note components emit events when updates occur
- Parent component handles API calls and state updates

## Testing

No explicit test files were found in the current project structure. Testing would likely involve:
- Unit tests for Vue components
- Integration tests for API endpoints
- End-to-end tests for user interactions

## Deployment

For production deployment:
1. Build the frontend: `npm run build` in the frontend directory
2. Serve the built files through a web server or CDN
3. Deploy the backend server with Node.js runtime
4. Configure the proxy settings appropriately for production

## Notes

- The application uses Chinese text for UI elements and confirmations
- The database file `notes.db` is stored in the backend directory
- The Vite proxy configuration automatically forwards API requests from the frontend to the backend
- Drag-and-drop functionality is implemented using native HTML5 drag events
- The application implements a soft deletion mechanism with a recycle bin feature
- Markdown content is rendered safely using markdown-it and DOMPurify