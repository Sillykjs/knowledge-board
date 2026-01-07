const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 创建数据库连接
const dbPath = path.join(__dirname, 'notes.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initDb();
  }
});

// 初始化数据库表
function initDb() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      position_x INTEGER NOT NULL DEFAULT 0,
      position_y INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME DEFAULT NULL
    )
  `;

  db.run(createTableSQL, (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
    } else {
      console.log('Notes table ready');

      // 检查并添加 deleted_at 字段（用于已存在的数据库）
      db.all("PRAGMA table_info(notes)", [], (err, columns) => {
        if (!err) {
          const hasDeletedAt = columns.some(col => col.name === 'deleted_at');
          if (!hasDeletedAt) {
            db.run("ALTER TABLE notes ADD COLUMN deleted_at DATETIME DEFAULT NULL", (err) => {
              if (err) {
                console.error('Migration failed:', err.message);
              } else {
                console.log('Migration completed: added deleted_at column');
              }
            });
          }
        }
      });
    }
  });

  // 创建便签墙配置表
  const createConfigTableSQL = `
    CREATE TABLE IF NOT EXISTS wall_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      title TEXT NOT NULL DEFAULT '便签墙',
      remark TEXT NOT NULL DEFAULT '这是便签墙的备注信息',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.run(createConfigTableSQL, (err) => {
    if (err) {
      console.error('Error creating wall_config table:', err.message);
    } else {
      console.log('Wall config table ready');

      // 插入默认配置（如果不存在）
      const insertDefaultConfig = `
        INSERT OR IGNORE INTO wall_config (id, title, remark)
        VALUES (1, '便签墙', '这是便签墙的备注信息')
      `;
      db.run(insertDefaultConfig, (err) => {
        if (err) {
          console.error('Error inserting default config:', err.message);
        } else {
          console.log('Default wall config initialized');
        }
      });
    }
  });
}

module.exports = db;
