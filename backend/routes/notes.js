const express = require('express');
const router = express.Router();
const db = require('../database');
const axios = require('axios');

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

  if (title === undefined || title === null || content === undefined || content === null) {
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

    // 查询新创建的便签以获取完整信息（包括 created_at）
    db.get(
      'SELECT * FROM notes WHERE id = ?',
      [this.lastID],
      (selectErr, note) => {
        if (selectErr) {
          res.status(500).json({ error: selectErr.message });
          return;
        }
        res.json({
          message: 'Note created',
          note: note
        });
      }
    );
  });
});

// ============ 回收站相关路由（必须在 /:id 之前定义）============

// 获取回收站中的便签列表（按白板过滤）
router.get('/recycle-bin', (req, res) => {
  const wall_id = req.query.wall_id || 1;

  const sql = `
    SELECT * FROM notes
    WHERE deleted_at IS NOT NULL AND wall_id = ?
    ORDER BY deleted_at DESC
  `;

  db.all(sql, [wall_id], (err, rows) => {
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

// 清空回收站（永久删除指定白板的所有已删除便签）
router.delete('/recycle-bin', (req, res) => {
  const wall_id = req.query.wall_id || 1;
  const sql = 'DELETE FROM notes WHERE deleted_at IS NOT NULL AND wall_id = ?';

  db.run(sql, [wall_id], function(err) {
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

// ============ AI生成路由（必须在 /:id 之前定义）============

// AI生成内容（流式输出，支持推理模型）
router.post('/ai-generate', async (req, res) => {
  const { prompt, wall_id, note_id, context_level = 1, include_reasoning = false, model_config } = req.body;

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  // 优先使用前端传递的模型配置，否则使用环境变量
  const apiKey = model_config?.api_key || process.env.OPENAI_API_KEY;
  const apiBase = model_config?.api_base || process.env.OPENAI_API_BASE;
  const model = model_config?.model || process.env.OPENAI_MODEL;

  if (!apiKey || !apiBase || !model) {
    res.status(500).json({ error: 'Model configuration is missing. Please configure the model in the sidebar or set up environment variables.' });
    return;
  }

  // 检测是否为推理模型
  const isReasoningModel = include_reasoning && (
    model?.startsWith('o1') ||
    model?.startsWith('glm-4.7')
  );

  // 获取白板的 system_prompt
  const boardId = wall_id || 1;
  db.get("SELECT system_prompt FROM boards WHERE id = ?", [boardId], async (err, board) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const systemPrompt = board?.system_prompt || 'You are a helpful assistant.';

    // 如果提供了 note_id，使用BFS获取多层父节点的便签内容作为上下文
    let contextNotes = [];
    if (note_id) {
      // 使用广度优先搜索（BFS）获取多层父节点
      const contextLevel = Math.min(Math.max(1, context_level || 1), 24); // 限制在1-24之间
      const visited = new Set(); // 避免循环引用
      const queue = [{ noteId: note_id, level: 0 }];
      const noteIds = new Set(); // 使用Set自动去重

      while (queue.length > 0) {
        const { noteId: currentNoteId, level } = queue.shift();

        // 如果达到指定的层数，停止查找
        if (level >= contextLevel) {
          continue;
        }

        // 如果已经访问过这个节点，跳过（避免循环）
        if (visited.has(currentNoteId)) {
          continue;
        }
        visited.add(currentNoteId);

        // 找到所有以当前节点为目标节点的连接（即父节点）
        const contextSql = `
          SELECT n.id, n.title, n.content
          FROM notes n
          INNER JOIN note_connections nc ON n.id = nc.source_note_id
          WHERE nc.target_note_id = ?
            AND n.deleted_at IS NULL
        `;

        const parentNotes = await new Promise((resolve, reject) => {
          db.all(contextSql, [currentNoteId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });

        // 添加父节点到结果集
        parentNotes.forEach(note => {
          noteIds.add(note.id);
          // 将父节点加入队列，继续查找其父节点（层数+1）
          queue.push({ noteId: note.id, level: level + 1 });
        });
      }

      // 根据收集的ID获取便签详情，按创建时间排序
      if (noteIds.size > 0) {
        const ids = Array.from(noteIds);
        const detailSql = `
          SELECT id, title, content
          FROM notes
          WHERE id IN (${ids.map(() => '?').join(',')})
            AND deleted_at IS NULL
          ORDER BY created_at ASC
        `;

        contextNotes = await new Promise((resolve, reject) => {
          db.all(detailSql, ids, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
      }
    }

    // 构建 messages 数组
    const messages = [];

    // 如果有 system_prompt，添加为 system 消息
    if (systemPrompt && systemPrompt.trim()) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // 如果有引入节点的内容，添加为上下文
    if (contextNotes.length > 0) {
      const contextText = contextNotes.map(note => {
        return `【${note.title}】\n${note.content || ''}`;
      }).join('\n\n');

      messages.push({
        role: 'user',
        content: `以下的内容作为上文参考：\n\n${contextText}\n\n`
      });
    }

    // 添加用户消息
    messages.push({
      role: 'user',
      content: prompt
    });

    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      // 构建请求体
      const requestBody = {
        model: model,
        messages: messages,
        stream: true  // 启用流式输出
      };

      // 如果是推理模型，添加reasoning_effort参数
      if (isReasoningModel) {
        requestBody.max_completion_tokens = 10000;
        requestBody.reasoning_effort = 'medium';  // low, medium, high
      } else {
        requestBody.temperature = 0.7;
      }

      const response = await axios.post(
        `${apiBase}/chat/completions`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          responseType: 'stream'  // 接收流式响应
        }
      );

      let hasReasoning = false;
      let reasoningEnded = false;

      // 处理流式数据
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            // 检查是否为结束标记
            if (data === '[DONE]') {
              res.write('data: [DONE]\n\n');
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              if (delta) {
                // 检查reasoning字段（推理模型特有）
                if (delta.reasoning || delta.reasoning_content) {
                  const reasoningText = delta.reasoning || delta.reasoning_content || '';

                  // 如果是第一次接收到reasoning，发送开始标记
                  if (!hasReasoning && reasoningText) {
                    hasReasoning = true;
                    res.write(`data: ${JSON.stringify({ content: '<!-- REASONING -->\n' })}\n\n`);
                  }

                  if (reasoningText) {
                    res.write(`data: ${JSON.stringify({ content: reasoningText })}\n\n`);
                  }
                }
                // 处理常规content
                else if (delta.content) {
                  const content = delta.content;

                  // 如果reasoning结束但还没发送结束标记
                  if (hasReasoning && !reasoningEnded) {
                    res.write(`data: ${JSON.stringify({ content: '<!-- END_REASONING -->\n\n' })}\n\n`);
                    reasoningEnded = true;
                  }

                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });

      response.data.on('end', () => {
        res.write('data: [DONE]\n\n');
        res.end();
      });

      response.data.on('error', (err) => {
        console.error('Stream error:', err);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      });
    } catch (error) {
      console.error('AI generation error:', error.response?.data || error.message);
      res.write(`data: ${JSON.stringify({ error: 'Failed to generate content', details: error.response?.data?.error?.message || error.message })}\n\n`);
      res.end();
    }
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
