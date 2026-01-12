const express = require('express');
const router = express.Router();
const db = require('../database');

// 获取所有白板
router.get('/', (req, res) => {
  const sql = `
    SELECT b.id, b.title, b.system_prompt, b.created_at, b.updated_at,
           COUNT(DISTINCT n.id) as note_count
    FROM boards b
    LEFT JOIN notes n ON b.id = n.wall_id AND n.deleted_at IS NULL
    GROUP BY b.id
    ORDER BY b.updated_at DESC
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

// 删除白板
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  // 不允许删除默认白板（id=1）
  if (parseInt(id) === 1) {
    res.status(403).json({ error: 'Cannot delete default board' });
    return;
  }

  const sql = 'DELETE FROM boards WHERE id = ?';

  db.run(sql, id, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    res.json({ message: 'Board deleted' });
  });
});

module.exports = router;
