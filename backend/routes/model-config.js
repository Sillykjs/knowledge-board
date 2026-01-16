const express = require('express');
const router = express.Router();
const db = require('../database');

// 掩码处理函数
function maskApiKey(apiKey) {
  if (!apiKey) return '';
  if (apiKey.length <= 10) return '***';
  // 保留前3个字符和后4个字符
  return apiKey.slice(0, 3) + '***...' + apiKey.slice(-4);
}

// 获取所有模型配置（API Key 已掩码）
router.get('/', (req, res) => {
  db.all("SELECT * FROM model_configs ORDER BY provider", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const configs = rows.map(row => ({
      id: row.id,
      provider: row.provider,
      apiBase: row.api_base,
      apiKey: maskApiKey(row.api_key),  // 掩码处理
      _masked: true,                     // 标识这是掩码
      models: JSON.parse(row.models || '[]')
    }));

    res.json(configs);
  });
});

// 保存模型配置
router.post('/', (req, res) => {
  const configs = req.body;

  if (!Array.isArray(configs)) {
    res.status(400).json({ error: 'Configs must be an array' });
    return;
  }

  // 使用事务确保所有操作要么全部成功，要么全部回滚
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    let completed = 0;
    let hasError = false;

    configs.forEach((item, index) => {
      // 验证必需字段
      if (!item.provider || !item.apiBase || !item.models) {
        hasError = true;
        res.status(400).json({ error: `Item ${index}: Missing required fields (provider, apiBase, models)` });
        return;
      }

      if (item._keepOriginalKey && item.id) {
        // 保持原密钥不变，只更新其他字段
        db.run(
          "UPDATE model_configs SET provider=?, api_base=?, models=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
          [item.provider, item.apiBase, JSON.stringify(item.models), item.id],
          (err) => {
            if (err) {
              hasError = true;
              res.status(500).json({ error: err.message });
              return;
            }

            completed++;
            if (completed === configs.length) {
              if (hasError) {
                db.run("ROLLBACK");
              } else {
                db.run("COMMIT", (err) => {
                  if (err) {
                    res.status(500).json({ error: err.message });
                  } else {
                    res.json({ message: 'Model configs saved successfully', count: completed });
                  }
                });
              }
            }
          }
        );
      } else {
        // 插入或更新（包括新密钥）
        db.run(
          `INSERT OR REPLACE INTO model_configs (provider, api_base, api_key, models, updated_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [item.provider, item.apiBase, item.apiKey || '', JSON.stringify(item.models)],
          function(err) {
            if (err) {
              hasError = true;
              res.status(500).json({ error: err.message });
              return;
            }

            completed++;
            if (completed === configs.length) {
              if (hasError) {
                db.run("ROLLBACK");
              } else {
                db.run("COMMIT", (err) => {
                  if (err) {
                    res.status(500).json({ error: err.message });
                  } else {
                    res.json({ message: 'Model configs saved successfully', count: completed });
                  }
                });
              }
            }
          }
        );
      }
    });
  });
});

module.exports = router;
