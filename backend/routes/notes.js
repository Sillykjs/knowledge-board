const express = require('express');
const router = express.Router();
const db = require('../database');

// ============ 便签墙配置相关路由 ============

// 获取便签墙配置
router.get('/config', (req, res) => {
  const sql = 'SELECT title, remark FROM wall_config WHERE id = 1';
  db.get(sql, [], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      // 如果配置不存在，返回默认值
      res.json({ title: '便签墙', remark: '这是便签墙的备注信息' });
      return;
    }
    res.json({ title: row.title, remark: row.remark });
  });
});

// 更新便签墙配置
router.put('/config', (req, res) => {
  const { title, remark } = req.body;

  if (!title || !remark) {
    res.status(400).json({ error: 'Title and remark are required' });
    return;
  }

  const sql = `
    UPDATE wall_config
    SET title = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `;
  const params = [title, remark];

  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      message: 'Wall config updated',
      title,
      remark
    });
  });
});

// ============ 便签相关路由 ============

// 获取所有便签（只返回未删除的）
router.get('/', (req, res) => {
  const sql = 'SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY created_at DESC';
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ notes: rows });
  });
});

// 创建新便签
router.post('/', (req, res) => {
  const { title, content, position_x, position_y } = req.body;

  if (!title || !content) {
    res.status(400).json({ error: 'Title and content are required' });
    return;
  }

  const sql = `
    INSERT INTO notes (title, content, position_x, position_y)
    VALUES (?, ?, ?, ?)
  `;
  const params = [title, content, position_x || 0, position_y || 0];

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
        position_y: position_y || 0
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
  const sql = "UPDATE notes SET deleted_at = datetime('now', 'localtime') WHERE id = ?";

  db.run(sql, id, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    res.json({ message: 'Note moved to recycle bin' });
  });
});

module.exports = router;
