const express = require('express');
const router = express.Router();
const db = require('../database');

// 引入白板路由
const boardsRouter = require('./boards');
router.use('/boards', boardsRouter);

// ============ 连接相关路由（必须在 /:id 之前定义）============

// 获取所有连接关系
router.get('/connections', (req, res) => {
  const wall_id = req.query.wall_id || 1;

  const sql = `
    SELECT nc.id, nc.source_note_id, nc.target_note_id, nc.created_at
    FROM note_connections nc
    INNER JOIN notes source_note ON nc.source_note_id = source_note.id
    INNER JOIN notes target_note ON nc.target_note_id = target_note.id
    WHERE source_note.deleted_at IS NULL
      AND target_note.deleted_at IS NULL
      AND nc.wall_id = ?
    ORDER BY nc.created_at DESC
  `;

  db.all(sql, [wall_id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ connections: rows });
  });
});

// 创建新连接
router.post('/connections', (req, res) => {
  const { source_note_id, target_note_id, wall_id } = req.body;

  if (!source_note_id || !target_note_id) {
    res.status(400).json({ error: 'source_note_id and target_note_id are required' });
    return;
  }

  if (source_note_id === target_note_id) {
    res.status(400).json({ error: 'Cannot connect a note to itself' });
    return;
  }

  // 获取源便签所属的白板ID
  db.get(
    'SELECT wall_id FROM notes WHERE id = ?',
    [source_note_id],
    (err, note) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!note) {
        res.status(404).json({ error: 'Source note not found' });
        return;
      }

      const boardId = wall_id || note.wall_id || 1;

      const sql = `
        INSERT INTO note_connections (source_note_id, target_note_id, wall_id)
        VALUES (?, ?, ?)
      `;

      db.run(sql, [source_note_id, target_note_id, boardId], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            res.status(400).json({ error: 'Connection already exists' });
          } else {
            res.status(500).json({ error: err.message });
          }
          return;
        }

        res.status(201).json({
          message: 'Connection created',
          connection: {
            id: this.lastID,
            source_note_id,
            target_note_id,
            wall_id: boardId
          }
        });
      });
    }
  );
});

// 删除连接（通过连接ID）
router.delete('/connections/:connectionId', (req, res) => {
  const { connectionId } = req.params;
  const sql = 'DELETE FROM note_connections WHERE id = ?';

  db.run(sql, connectionId, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }
    res.json({ message: 'Connection deleted' });
  });
});

// ============ 便签相关路由 ============

// 获取所有便签（只返回未删除的）
router.get('/', (req, res) => {
  const wall_id = req.query.wall_id || 1;

  const sql = 'SELECT * FROM notes WHERE wall_id = ? AND deleted_at IS NULL ORDER BY created_at DESC';
  db.all(sql, [wall_id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ notes: rows });
  });
});

// 创建新便签
router.post('/', (req, res) => {
  const { title, content, position_x, position_y, wall_id } = req.body;

  if (!title || !content) {
    res.status(400).json({ error: 'Title and content are required' });
    return;
  }

  const sql = `
    INSERT INTO notes (title, content, position_x, position_y, wall_id)
    VALUES (?, ?, ?, ?, ?)
  `;
  const params = [title, content, position_x || 0, position_y || 0, wall_id || 1];

  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      message: 'Note created',
      note: {
        id: this.lastID,
        title,
        content,
        position_x: position_x || 0,
        position_y: position_y || 0,
        wall_id: wall_id || 1
      }
    });
  });
});

// ============ 回收站相关路由（必须在 /:id 之前定义）============

// 获取回收站中的便签列表
router.get('/recycle-bin', (req, res) => {
  const sql = `
    SELECT * FROM notes
    WHERE deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ notes: rows });
  });
});

// 从回收站恢复便签
router.post('/recycle-bin/restore/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'UPDATE notes SET deleted_at = NULL WHERE id = ?';

  db.run(sql, id, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Note not found in recycle bin' });
      return;
    }
    res.json({ message: 'Note restored successfully' });
  });
});

// 从回收站永久删除单个便签
router.delete('/recycle-bin/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM notes WHERE id = ? AND deleted_at IS NOT NULL';

  db.run(sql, id, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Note not found in recycle bin' });
      return;
    }
    res.json({ message: 'Note permanently deleted' });
  });
});

// 清空回收站（永久删除所有已删除便签）
router.delete('/recycle-bin', (req, res) => {
  const sql = 'DELETE FROM notes WHERE deleted_at IS NOT NULL';

  db.run(sql, [], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      message: 'Recycle bin emptied',
      count: this.changes
    });
  });
});

// ============ 通用便签路由 ============

// 更新便签
router.put('/:id', (req, res) => {
  const { title, content, position_x, position_y } = req.body;
  const { id } = req.params;

  const sql = `
    UPDATE notes
    SET title = ?, content = ?, position_x = ?, position_y = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  const params = [title, content, position_x, position_y, id];

  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    res.json({ message: 'Note updated' });
  });
});

// 删除便签（软删除，移入回收站）
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  // 先删除与该便签相关的所有连接关系
  const deleteConnectionsSql = `
    DELETE FROM note_connections
    WHERE source_note_id = ? OR target_note_id = ?
  `;

  db.run(deleteConnectionsSql, [id, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const connectionsDeleted = this.changes;

    // 然后软删除便签
    const deleteNoteSql = "UPDATE notes SET deleted_at = datetime('now', 'localtime') WHERE id = ?";

    db.run(deleteNoteSql, id, function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Note not found' });
        return;
      }
      res.json({
        message: 'Note moved to recycle bin',
        connectionsDeleted: connectionsDeleted
      });
    });
  });
});

module.exports = router;
