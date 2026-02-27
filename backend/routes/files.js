const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database');

const getFilePath = (filename, category) => {
  const dir = category === 'image' ? 'images' : 'documents';
  return path.join(__dirname, `../public/uploads/${dir}/${filename}`);
};

router.get('/', (req, res) => {
  const { category, note_id } = req.query;

  let sql = 'SELECT * FROM files';
  const params = [];
  const conditions = [];

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  if (note_id) {
    conditions.push('note_id = ?');
    params.push(note_id);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const files = rows.map(file => ({
      ...file,
      url: `/uploads/${file.category === 'image' ? 'images' : 'documents'}/${file.filename}`
    }));

    res.json({ files });
  });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM files WHERE id = ?', [id], (err, file) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = getFilePath(file.filename, file.category);

    db.run('DELETE FROM files WHERE id = ?', [id], function(deleteErr) {
      if (deleteErr) {
        return res.status(500).json({ error: deleteErr.message });
      }

      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.error('Failed to delete file from disk:', unlinkErr);
        }
      }

      res.json({ message: 'File deleted successfully' });
    });
  });
});

router.post('/cleanup', (req, res) => {
  const { category, note_id } = req.body;

  let sql = 'SELECT * FROM files';
  const params = [];
  const conditions = [];

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  if (note_id) {
    conditions.push('note_id = ?');
    params.push(note_id);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    let deletedCount = 0;
    const errors = [];

    rows.forEach(file => {
      const filePath = getFilePath(file.filename, file.category);

      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          errors.push(`Failed to delete ${file.filename}: ${unlinkErr.message}`);
        }
      }

      db.run('DELETE FROM files WHERE id = ?', [file.id], (deleteErr) => {
        if (deleteErr) {
          errors.push(`Failed to delete DB record for ${file.filename}: ${deleteErr.message}`);
        } else {
          deletedCount++;
        }
      });
    });

    setTimeout(() => {
      res.json({
        message: 'Cleanup completed',
        deletedCount,
        deleted: rows.length,
        errors
      });
    }, 100);
  });
});

router.get('/stats', (req, res) => {
  const { category, note_id } = req.query;

  let sql = `
    SELECT
      category,
      COUNT(*) as count,
      SUM(file_size) as total_size
    FROM files
  `;
  const params = [];
  const conditions = [];

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  if (note_id) {
    conditions.push('note_id = ?');
    params.push(note_id);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' GROUP BY category';

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const stats = {
      total_files: 0,
      total_size: 0,
      by_category: {}
    };

    rows.forEach(row => {
      stats.total_files += row.count;
      stats.total_size += row.total_size || 0;
      stats.by_category[row.category] = {
        count: row.count,
        total_size: row.total_size || 0
      };
    });

    res.json(stats);
  });
});

module.exports = router;
