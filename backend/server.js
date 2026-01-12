// 加载环境变量
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const notesRouter = require('./routes/notes');

const app = express();
const PORT = 3001;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 路由
app.use('/api/notes', notesRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
