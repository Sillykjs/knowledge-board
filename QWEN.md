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

## Project Structure

```
├── backend/                 # Node.js/Express backend
│   ├── server.js           # Main server file
│   ├── database.js         # SQLite database configuration
│   ├── routes/
│   │   └── notes.js        # Notes API routes
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

- `GET /api/notes` - Retrieve all notes
- `POST /api/notes` - Create a new note
- `PUT /api/notes/:id` - Update an existing note
- `DELETE /api/notes/:id` - Delete a note
- `GET /api/health` - Health check endpoint

## Database Schema

The application uses SQLite with a single `notes` table:

```sql
CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
- Vue 3 with Composition API (though using Options API in current implementation)
- Component-based architecture
- Axios for API communication
- CSS with scoped styles
- Responsive design with grid background

### Backend
- Express.js for routing
- SQLite for data persistence
- RESTful API design
- Error handling with appropriate HTTP status codes
- Input validation for required fields

### Code Style
- JavaScript ES6+ syntax
- Consistent indentation (2 spaces)
- Descriptive variable and function names
- Proper error handling and logging
- API responses follow consistent JSON structure

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