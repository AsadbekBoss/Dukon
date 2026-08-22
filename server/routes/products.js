const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendCsv } = require('../utils/csv');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth);

// Barcha rollar mahsulotlarni ko'ra oladi, qidiruv/kategoriya/kam-qoldiq filtri bilan
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, category, low_stock } = req.query;
    const shartlar = [];
    const params = [];

    if (q && String(q).trim()) {
      shartlar.push('(nomi LIKE ? OR kategoriya LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (category && String(category).trim()) {
      shartlar.push('kategoriya = ?');
      params.push(category);
    }
    if (low_stock === 'true') {
      shartlar.push('miqdor <= min_miqdor');
    }

    const where = shartlar.length ? `WHERE ${shartlar.join(' AND ')}` : '';
    const products = await db.all(`SELECT * FROM products ${where} ORDER BY nomi ASC`, params);
    res.json({ products });
  })
);

// Mavjud kategoriyalar ro'yxati (filtr uchun)
router.get(
  '/meta/categories',
  asyncHandler(async (req, res) => {
    const rows = await db.all(
      "SELECT DISTINCT kategoriya FROM products WHERE kategoriya IS NOT NULL AND kategoriya != '' ORDER BY kategoriya ASC"
    );
    res.json({ categories: rows.map((r) => r.kategoriya) });
  })
);

// Mahsulotlar ro'yxatini CSV (Excel) shaklida yuklab olish
router.get(
  '/export/csv',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const products = await db.all('SELECT * FROM products ORDER BY nomi ASC');
    const headers = ['ID', 'Nomi', 'Kategoriya', 'Ichki guruh', 'Tannarx', 'Sotish narxi', 'Foyda/dona', 'Qoldiq', 'Min qoldiq'];
    const rows = products.map((p) => [
      p.id,
      p.nomi,
      p.kategoriya || '',
      p.ichki_guruh || '',
      p.tannarx,
      p.sotish_narxi,
      p.sotish_narxi - p.tannarx,
      p.miqdor,
      p.min_miqdor,
    ]);
    sendCsv(res, 'mahsulotlar.csv', headers, rows);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await db.get('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]);
    if (!product) return res.status(404).json({ xato: 'Mahsulot topilmadi' });
    res.json({ product });
  })
);

router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { nomi, tannarx, sotish_narxi, miqdor, kategoriya, min_miqdor, rasm, ichki_guruh } = req.body || {};
    if (!nomi || tannarx == null || sotish_narxi == null) {
      return res.status(400).json({ xato: 'Nomi, tannarx va sotish narxi kiritilishi shart' });
    }
    const tn = Number(tannarx);
    const sn = Number(sotish_narxi);
    const mq = Number(miqdor ?? 0);
    const minMq = Number(min_miqdor ?? 5);
    if ([tn, sn, mq, minMq].some((v) => Number.isNaN(v) || v < 0)) {
      return res.status(400).json({ xato: 'Raqamli qiymatlar noto\'g\'ri' });
    }
    if (rasm && !String(rasm).startsWith('data:image/')) {
      return res.status(400).json({ xato: "Rasm formati noto'g'ri" });
    }
    const info = await db.run(
      'INSERT INTO products (nomi, tannarx, sotish_narxi, miqdor, kategoriya, min_miqdor, rasm, ichki_guruh) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [nomi, tn, sn, mq, kategoriya || null, minMq, rasm || null, (ichki_guruh || '').trim() || null]
    );
    const product = await db.get('SELECT * FROM products WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json({ product });
  })
);

router.put(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const target = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!target) return res.status(404).json({ xato: 'Mahsulot topilmadi' });

    const { nomi, tannarx, sotish_narxi, miqdor, kategoriya, min_miqdor, rasm, ichki_guruh } = req.body || {};

    const yangiNomi = nomi ?? target.nomi;
    const yangiTannarx = tannarx != null ? Number(tannarx) : target.tannarx;
    const yangiSotishNarxi = sotish_narxi != null ? Number(sotish_narxi) : target.sotish_narxi;
    const yangiMiqdor = miqdor != null ? Number(miqdor) : target.miqdor;
    const yangiKategoriya = kategoriya !== undefined ? kategoriya : target.kategoriya;
    const yangiMinMiqdor = min_miqdor != null ? Number(min_miqdor) : target.min_miqdor;
    const yangiRasm = rasm !== undefined ? rasm : target.rasm;
    const yangiIchkiGuruh = ichki_guruh !== undefined ? String(ichki_guruh).trim() || null : target.ichki_guruh;

    if ([yangiTannarx, yangiSotishNarxi, yangiMiqdor, yangiMinMiqdor].some((v) => Number.isNaN(v) || v < 0)) {
      return res.status(400).json({ xato: 'Raqamli qiymatlar noto\'g\'ri' });
    }
    if (yangiRasm && !String(yangiRasm).startsWith('data:image/')) {
      return res.status(400).json({ xato: "Rasm formati noto'g'ri" });
    }

    await db.run(
      'UPDATE products SET nomi = ?, tannarx = ?, sotish_narxi = ?, miqdor = ?, kategoriya = ?, min_miqdor = ?, rasm = ?, ichki_guruh = ? WHERE id = ?',
      [yangiNomi, yangiTannarx, yangiSotishNarxi, yangiMiqdor, yangiKategoriya, yangiMinMiqdor, yangiRasm, yangiIchkiGuruh, id]
    );

    const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    res.json({ product });
  })
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const target = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!target) return res.status(404).json({ xato: 'Mahsulot topilmadi' });
    await db.run('DELETE FROM products WHERE id = ?', [id]);
    res.json({ ok: true });
  })
);

module.exports = router;
