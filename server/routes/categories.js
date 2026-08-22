const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth);

// Barcha kategoriyalar (mahsulotsiz ham) + har biridagi mahsulot soni
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const categories = await db.all('SELECT * FROM categories ORDER BY nomi ASC');
    const counts = await db.all(
      `SELECT kategoriya,
              COUNT(*) AS soni,
              SUM(CASE WHEN miqdor <= min_miqdor THEN 1 ELSE 0 END) AS kam_qoldiq
       FROM products
       WHERE kategoriya IS NOT NULL AND kategoriya != ''
       GROUP BY kategoriya`
    );
    const countMap = new Map(counts.map((c) => [c.kategoriya, c]));

    const natija = categories.map((c) => {
      const found = countMap.get(c.nomi);
      return {
        ...c,
        soni: found ? found.soni : 0,
        kam_qoldiq: found ? found.kam_qoldiq : 0,
      };
    });

    res.json({ categories: natija });
  })
);

function validateImage(rasm) {
  if (rasm && !String(rasm).startsWith('data:image/')) {
    return "Rasm formati noto'g'ri";
  }
  return null;
}

router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { nomi, icon, rasm } = req.body || {};
    const name = (nomi || '').trim();
    if (!name) {
      return res.status(400).json({ xato: "Kategoriya nomi kiritilishi shart" });
    }
    const imgErr = validateImage(rasm);
    if (imgErr) return res.status(400).json({ xato: imgErr });

    const exists = await db.get('SELECT id FROM categories WHERE nomi = ?', [name]);
    if (exists) {
      return res.status(409).json({ xato: 'Bu kategoriya allaqachon mavjud' });
    }
    const info = await db.run('INSERT INTO categories (nomi, icon, rasm) VALUES (?, ?, ?)', [
      name,
      icon || null,
      rasm || null,
    ]);
    const category = await db.get('SELECT * FROM categories WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json({ category });
  })
);

router.put(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const target = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    if (!target) return res.status(404).json({ xato: 'Kategoriya topilmadi' });

    const { nomi, icon, rasm } = req.body || {};
    const yangiNomi = nomi !== undefined ? String(nomi).trim() : target.nomi;
    const yangiIcon = icon !== undefined ? icon || null : target.icon;
    const yangiRasm = rasm !== undefined ? rasm || null : target.rasm;

    if (!yangiNomi) {
      return res.status(400).json({ xato: "Kategoriya nomi bo'sh bo'lishi mumkin emas" });
    }
    const imgErr = validateImage(yangiRasm);
    if (imgErr) return res.status(400).json({ xato: imgErr });

    if (yangiNomi !== target.nomi) {
      const exists = await db.get('SELECT id FROM categories WHERE nomi = ? AND id != ?', [yangiNomi, id]);
      if (exists) return res.status(409).json({ xato: 'Bu nomdagi kategoriya allaqachon mavjud' });
    }

    await db.run('UPDATE categories SET nomi = ?, icon = ?, rasm = ? WHERE id = ?', [
      yangiNomi,
      yangiIcon,
      yangiRasm,
      id,
    ]);

    if (yangiNomi !== target.nomi) {
      await db.run('UPDATE products SET kategoriya = ? WHERE kategoriya = ?', [yangiNomi, target.nomi]);
    }

    const category = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ category });
  })
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const target = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    if (!target) return res.status(404).json({ xato: 'Kategoriya topilmadi' });

    const row = await db.get('SELECT COUNT(*) AS soni FROM products WHERE kategoriya = ?', [target.nomi]);
    if (row.soni > 0) {
      return res
        .status(400)
        .json({ xato: `Bu kategoriyada ${row.soni} ta mahsulot bor, avval ularni boshqa kategoriyaga o'tkazing yoki o'chiring` });
    }

    await db.run('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ ok: true });
  })
);

module.exports = router;
