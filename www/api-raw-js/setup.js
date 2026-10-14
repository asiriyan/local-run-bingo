const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { app: electronApp } = require('electron');
const Database = require('better-sqlite3-multiple-ciphers');
const { db, config } = require('../config');

// Absolute, writable path — outside asar entirely
const uploadsDir = path.join(electronApp.getPath('userData'), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.bin')) {
      cb(null, true);
    } else {
      cb(new Error('Only .bin files are allowed'));
    }
  }
});

router.get('/status', (req, res) => {
  try {
    const dbExists = fs.existsSync(config.dbPath);
    res.json({ dbExists });
  } catch (error) {
    res.json({ dbExists: false });
  }
});

router.post('/verify-admin', (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.json({ success: false, error: 'Password is required' });
    }
    if (password === config.adminSetupPassword) {
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'Invalid setup password' });
    }
  } catch (error) {
    console.error('Admin verification error:', error);
    res.json({ success: false, error: 'Verification failed' });
  }
});

router.post('/upload-db', upload.single('database'), (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, error: 'No file uploaded' });
    }

    const uploadedFilePath = req.file.path;
    const targetDbPath = config.dbPath;

    console.log('=== DATABASE UPLOAD DEBUG ===');
    console.log('Uploaded file path:', uploadedFilePath);
    console.log('File size:', req.file.size, 'bytes');
    console.log('Target path:', targetDbPath);

    const targetDir = path.dirname(targetDbPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Validate the uploaded file actually opens with the configured cipher key
    // before committing it as the production database
    const testDb = new Database(uploadedFilePath, { fileMustExist: true });
    testDb.pragma(`key='${config.dbKey}'`);
    testDb.prepare("SELECT count(*) FROM sqlite_master").get(); // throws if key is wrong
    testDb.close();

    fs.copyFileSync(uploadedFilePath, targetDbPath);
    console.log('File copied successfully to:', targetDbPath);

    fs.unlinkSync(uploadedFilePath);

    res.json({ success: true, message: 'Database installed successfully' });
  } catch (error) {
    console.error('Database upload error:', error);
    // Clean up the temp file even on failure
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.json({ success: false, error: 'Upload failed: ' + error.message });
  }
});

module.exports = router;