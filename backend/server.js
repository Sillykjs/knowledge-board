const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const notesRouter = require('./routes/notes');
const modelConfigRouter = require('./routes/model-config');
const uploadRouter = require('./routes/upload');
const filesRouter = require('./routes/files');

const app = express();
const PORT = 3001;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// 路由
app.use('/api/notes', notesRouter);
app.use('/api/model-config', modelConfigRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/files', filesRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
