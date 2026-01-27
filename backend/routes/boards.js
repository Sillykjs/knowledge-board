const express = require('express');
const router = express.Router();
const db = require('../database');

// 获取所有白板
router.get('/', (req, res) => {
  const sql = `
    SELECT b.id, b.title, b.system_prompt, b.created_at, b.updated_at, b.sort_order,
           COUNT(DISTINCT n.id) as note_count
    FROM boards b
    LEFT JOIN notes n ON b.id = n.wall_id AND n.deleted_at IS NULL
    GROUP BY b.id
    ORDER BY b.sort_order ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ boards: rows });
  });
});

// 创建白板
router.post('/', (req, res) => {
  const { title, system_prompt } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const sql = `
    INSERT INTO boards (title, system_prompt)
    VALUES (?, ?)
  `;
  const params = [title || '新白板', system_prompt || ''];

  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(201).json({
      message: 'Board created',
      board: {
        id: this.lastID,
        title,
        system_prompt,
        note_count: 0
      }
    });
  });
});

// 批量更新白板排序（必须在 /:id 之前）
router.put('/reorder', (req, res) => {
  const { boardOrders } = req.body; // boardOrders: [{ id: 1, sort_order: 0 }, { id: 2, sort_order: 1 }, ...]

  if (!Array.isArray(boardOrders)) {
    res.status(400).json({ error: 'boardOrders must be an array' });
    return;
  }

  // 使用事务批量更新
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    const updateStmt = db.prepare('UPDATE boards SET sort_order = ? WHERE id = ?');

    let completed = 0;
    let hasError = false;

    boardOrders.forEach(item => {
      updateStmt.run(item.sort_order, item.id, function(err) {
        if (err) {
          hasError = true;
          console.error('Error updating board sort_order:', err.message);
        }
        completed++;

        if (completed === boardOrders.length) {
          updateStmt.finalize();

          if (hasError) {
            db.run('ROLLBACK');
            res.status(500).json({ error: 'Failed to update some boards' });
          } else {
            db.run('COMMIT', (err) => {
              if (err) {
                res.status(500).json({ error: err.message });
              } else {
                res.json({ message: 'Boards reordered successfully' });
              }
            });
          }
        }
      });
    });
  });
});

// 获取单个白板配置
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'SELECT id, title, system_prompt, created_at, updated_at FROM boards WHERE id = ?';

  db.get(sql, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    res.json({ board: row });
  });
});

// 更新白板配置
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { title, system_prompt } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const sql = `
    UPDATE boards
    SET title = ?, system_prompt = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  const params = [title, system_prompt || '', id];

  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    res.json({
      message: 'Board updated',
      board: { id: parseInt(id), title, system_prompt }
    });
  });
});

// 删除白板（级联删除便签和连接）
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  // 不允许删除默认白板（id=1）
  if (parseInt(id) === 1) {
    res.status(403).json({ error: 'Cannot delete default board' });
    return;
  }

  // 使用事务确保数据一致性
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // 1. 删除该白板的所有连接
    db.run('DELETE FROM note_connections WHERE wall_id = ?', [id], (err) => {
      if (err) {
        console.error('Error deleting note_connections:', err.message);
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }

      // 2. 删除该白板的所有便签（note_connections 有级联删除，但这里直接删除更安全）
      db.run('DELETE FROM notes WHERE wall_id = ?', [id], (err) => {
        if (err) {
          console.error('Error deleting notes:', err.message);
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }

        // 3. 删除白板
        db.run('DELETE FROM boards WHERE id = ?', [id], function(err) {
          if (err) {
            console.error('Error deleting board:', err.message);
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }

          if (this.changes === 0) {
            db.run('ROLLBACK');
            res.status(404).json({ error: 'Board not found' });
            return;
          }

          // 提交事务
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('Error committing transaction:', err.message);
              res.status(500).json({ error: err.message });
              return;
            }

            console.log(`Board ${id} deleted successfully with all notes and connections`);
            res.json({
              message: 'Board deleted',
              details: 'Board and all associated notes/connections have been removed'
            });
          });
        });
      });
    });
  });
});

module.exports = router;
