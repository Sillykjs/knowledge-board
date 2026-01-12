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
      deleted_at DATETIME DEFAULT NULL,
      wall_id INTEGER NOT NULL DEFAULT 1
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

  // 创建便签连接表
  const createConnectionsTableSQL = `
    CREATE TABLE IF NOT EXISTS note_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_note_id INTEGER NOT NULL,
      target_note_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      wall_id INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_note_id) REFERENCES notes(id) ON DELETE CASCADE,
      UNIQUE(source_note_id, target_note_id)
    )
  `;

  db.run(createConnectionsTableSQL, (err) => {
    if (err) {
      console.error('Error creating note_connections table:', err.message);
    } else {
      console.log('Note connections table ready');

      // 创建索引以优化查询性能
      const createIndexSQL = `
        CREATE INDEX IF NOT EXISTS idx_connections_source ON note_connections(source_note_id);
        CREATE INDEX IF NOT EXISTS idx_connections_target ON note_connections(target_note_id);
        CREATE INDEX IF NOT EXISTS idx_connections_wall_id ON note_connections(wall_id);
      `;

      db.run(createIndexSQL, (err) => {
        if (err) {
          console.error('Error creating indexes:', err.message);
        } else {
          console.log('Note connections indexes ready');
        }
      });
    }
  });

  // 多白板功能迁移
  migrateToMultiBoard();
  migrateNotesToBoards();
  migrateConnectionsToBoards();
  migrateBoardsRemarkToSystemPrompt();
}

// ========== 多白板功能迁移函数 ==========

// 创建 boards 表并从 wall_config 迁移数据
function migrateToMultiBoard() {
  const createBoardsTableSQL = `
    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '新白板',
      system_prompt TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.run(createBoardsTableSQL, (err) => {
    if (err) {
      console.error('Error creating boards table:', err.message);
      return;
    }
    console.log('Boards table ready');

    // 检查是否需要从 wall_config 迁移数据
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='wall_config'", [], (err, row) => {
      if (row) {
        // wall_config 表存在，需要迁移
        migrateFromWallConfig();
      } else {
        // wall_config 表不存在，创建默认白板
        createDefaultBoard();
      }
    });
  });
}

// 从 wall_config 迁移数据到 boards
function migrateFromWallConfig() {
  // 从 wall_config 读取配置
  db.get("SELECT title, remark FROM wall_config WHERE id = 1", [], (err, config) => {
    if (err) {
      console.error('Error reading wall_config:', err.message);
      createDefaultBoard();
      return;
    }

    // 创建默认白板（id=1）
    const defaultTitle = config?.title || '便签墙';
    const defaultSystemPrompt = config?.remark || '这是便签墙的备注信息';

    db.run(
      "INSERT INTO boards (id, title, system_prompt) VALUES (1, ?, ?)",
      [defaultTitle, defaultSystemPrompt],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            console.log('Default board already exists, skipping migration');
          } else {
            console.error('Error creating default board:', err.message);
          }
          return;
        }
        console.log('Default board created from wall_config');

        // 删除 wall_config 表
        db.run("DROP TABLE wall_config", (err) => {
          if (err) {
            console.error('Error dropping wall_config:', err.message);
          } else {
            console.log('wall_config table dropped');
          }
        });
      }
    );
  });
}

// 创建默认白板
function createDefaultBoard() {
  db.run(
    "INSERT OR IGNORE INTO boards (id, title, system_prompt) VALUES (1, '便签墙', '这是便签墙的备注信息')",
    (err) => {
      if (err) {
        console.error('Error creating default board:', err.message);
      } else {
        console.log('Default board initialized');
      }
    }
  );
}

// 为 notes 表添加 wall_id 字段
function migrateNotesToBoards() {
  // 检查 notes 表是否有 wall_id 字段
  db.all("PRAGMA table_info(notes)", [], (err, columns) => {
    if (err) {
      console.error('Error checking notes table:', err.message);
      return;
    }

    const hasWallId = columns.some(col => col.name === 'wall_id');
    if (hasWallId) {
      console.log('notes table already has wall_id column');
      return;
    }

    // 添加 wall_id 字段
    db.run(
      "ALTER TABLE notes ADD COLUMN wall_id INTEGER NOT NULL DEFAULT 1",
      (err) => {
        if (err) {
          console.error('Error adding wall_id to notes:', err.message);
        } else {
          console.log('Migration completed: added wall_id column to notes');

          // 创建索引
          db.run(
            "CREATE INDEX IF NOT EXISTS idx_notes_wall_id ON notes(wall_id)",
            (err) => {
              if (err) console.error('Error creating index:', err.message);
              else console.log('Index idx_notes_wall_id created');
            }
          );
        }
      }
    );
  });
}

// 为 note_connections 表添加 wall_id 字段
function migrateConnectionsToBoards() {
  // 检查 note_connections 表是否有 wall_id 字段
  db.all("PRAGMA table_info(note_connections)", [], (err, columns) => {
    if (err) {
      console.error('Error checking note_connections table:', err.message);
      return;
    }

    const hasWallId = columns.some(col => col.name === 'wall_id');
    if (hasWallId) {
      console.log('note_connections table already has wall_id column');
      return;
    }

    // 添加 wall_id 字段
    db.run(
      "ALTER TABLE note_connections ADD COLUMN wall_id INTEGER NOT NULL DEFAULT 1",
      (err) => {
        if (err) {
          console.error('Error adding wall_id to note_connections:', err.message);
        } else {
          console.log('Migration completed: added wall_id column to note_connections');

          // 创建索引
          db.run(
            "CREATE INDEX IF NOT EXISTS idx_connections_wall_id ON note_connections(wall_id)",
            (err) => {
              if (err) console.error('Error creating index:', err.message);
              else console.log('Index idx_connections_wall_id created');
            }
          );
        }
      }
    );
  });
}

// 将 boards 表的 remark 字段重命名为 system_prompt
function         migrateBoardsRemarkToSystemPrompt() {
  // 检查 boards 表是否有 remark 字段
  db.all("PRAGMA table_info(boards)", [], (err, columns) => {
    if (err) {
      console.error('Error checking boards table:', err.message);
      return;
    }

    const hasRemark = columns.some(col => col.name === 'remark');
    const hasSystemPrompt = columns.some(col => col.name === 'system_prompt');

    if (!hasRemark && hasSystemPrompt) {
      console.log('boards table already has system_prompt column');
      return;
    }

    if (hasRemark && !hasSystemPrompt) {
      // 使用 ALTER TABLE ... RENAME COLUMN (SQLite 3.25.0+)
      db.run("ALTER TABLE boards RENAME COLUMN remark TO system_prompt", (err) => {
        if (err) {
          // 如果RENAME COLUMN不支持，使用传统方法
          if (err.message.includes('syntax error')) {
            migrateBoardsRemarkToSystemPromptTraditional();
          } else {
            console.error('Error renaming remark to system_prompt:', err.message);
          }
        } else {
          console.log('Migration completed: renamed remark to system_prompt');
        }
      });
    }
  });
}

// 传统方法：创建新表，复制数据，删除旧表
function migrateBoardsRemarkToSystemPromptTraditional() {
  console.log('Using traditional migration method for remark -> system_prompt');

  // 创建临时表
  db.run(`
    CREATE TABLE boards_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '新白板',
      system_prompt TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating boards_new table:', err.message);
      return;
    }

    // 复制数据
    db.run(`
      INSERT INTO boards_new (id, title, system_prompt, created_at, updated_at)
      SELECT id, title, remark, created_at, updated_at FROM boards
    `, (err) => {
      if (err) {
        console.error('Error copying data to boards_new:', err.message);
        return;
      }

      // 删除旧表
      db.run('DROP TABLE boards', (err) => {
        if (err) {
          console.error('Error dropping boards table:', err.message);
          return;
        }

        // 重命名新表
        db.run('ALTER TABLE boards_new RENAME TO boards', (err) => {
          if (err) {
            console.error('Error renaming boards_new to boards:', err.message);
          } else {
            console.log('Migration completed: renamed remark to system_prompt (traditional method)');
          }
        });
      });
    });
  });
}

module.exports = db;
