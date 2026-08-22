const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const JADVALLAR = ['users', 'products', 'categories', 'sales'];

// Butun ma'lumotlar bazasini yuklab olish — faqat admin.
// Lokal (.db fayl) rejimida — haqiqiy SQLite faylni beradi.
// Turso (bulutli) rejimida — bitta JSON faylga barcha jadvallarni eksport qiladi
// (Turso'da SQLite fayl mavjud emas, bazaning o'zi masofaviy serverda saqlanadi).
router.get(
  '/download',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const sana = new Date().toISOString().slice(0, 10);

    if (!db.isRemote) {
      return res.download(db.dbPath, `dukon-zaxira-${sana}.db`, (err) => {
        if (err && !res.headersSent) {
          res.status(500).json({ xato: "Zaxira faylini yuklab bo'lmadi" });
        }
      });
    }

    const natija = {};
    for (const jadval of JADVALLAR) {
      natija[jadval] = await db.all(`SELECT * FROM ${jadval}`);
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dukon-zaxira-${sana}.json"`);
    res.send(JSON.stringify(natija, null, 2));
  })
);

module.exports = router;
