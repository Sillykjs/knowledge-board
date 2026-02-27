const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../database');

// 确保上传目录存在
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir(path.join(__dirname, '../public/uploads/images'));
ensureDir(path.join(__dirname, '../public/uploads/documents'));

const generateFileName = (originalName) => {
  const ext = path.extname(originalName);
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString('hex');
  return `${timestamp}_${randomHash}${ext}`;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = file.mimetype.startsWith('image/') ? 'images' : 'documents';
    const uploadPath = path.join(__dirname, `../public/uploads/${category}`);
    ensureDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const fileName = generateFileName(file.originalname);
    cb(null, fileName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];
  const allowedDocTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/x-markdown'
  ];

  if (allowedImageTypes.includes(file.mimetype) || allowedDocTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
  }
};

const uploadImage = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

const uploadDocument = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024
  }
});

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const isImageRoute = req.path === '/images';
      const maxSize = isImageRoute ? '50MB' : '200MB';
      return res.status(400).json({
        error: `File size exceeds the limit (max ${maxSize})`
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected file field name'
      });
    }
    return res.status(400).json({
      error: `Upload error: ${err.message}`
    });
  } else if (err) {
    return res.status(400).json({
      error: err.message
    });
  }
  next();
};

router.post('/images', uploadImage.single('file[]'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const note_id = req.body.note_id || null;
    const { originalname, filename, size, mimetype } = req.file;
    const category = 'image';
    const fileUrl = `/uploads/images/${filename}`;

    const insertSql = `
      INSERT INTO files (filename, original_name, file_size, mime_type, category, note_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(insertSql, [filename, originalname, size, mimetype, category, note_id], function(err) {
      if (err) {
        console.error('Database error:', err);
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: 'Failed to save file metadata' });
      }

      res.json({
        msg: '',
        data: {
          errFiles: [],
          succMap: {
            [filename]: `http://localhost:3001${fileUrl}`
          }
        }
      });
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/documents', uploadDocument.single('file[]'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const note_id = req.body.note_id || null;
    const { originalname, filename, size, mimetype } = req.file;
    const category = 'document';
    const fileUrl = `/uploads/documents/${filename}`;

    const insertSql = `
      INSERT INTO files (filename, original_name, file_size, mime_type, category, note_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(insertSql, [filename, originalname, size, mimetype, category, note_id], function(err) {
      if (err) {
        console.error('Database error:', err);
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: 'Failed to save file metadata' });
      }

      res.json({
        msg: '',
        data: {
          errFiles: [],
          succMap: {
            [filename]: `http://localhost:3001${fileUrl}`
          }
        }
      });
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

router.use(handleUploadError);

module.exports = router;
