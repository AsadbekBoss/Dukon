const express = require('express');
const db = require('../db');
const { hashPassword } = require('../utils/auth');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const users = await db.all('SELECT id, ism, login, rol, created_at FROM users ORDER BY id DESC');
    res.json({ users });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { ism, login, parol, rol } = req.body || {};
    if (!ism || !login || !parol || !rol) {
      return res.status(400).json({ xato: 'Barcha maydonlar to\'ldirilishi shart' });
    }
    if (!['admin', 'sotuvchi'].includes(rol)) {
      return res.status(400).json({ xato: 'Rol noto\'g\'ri (admin yoki sotuvchi)' });
    }
    const exists = await db.get('SELECT id FROM users WHERE login = ?', [login]);
    if (exists) {
      return res.status(409).json({ xato: 'Bu login band' });
    }
    const info = await db.run('INSERT INTO users (ism, login, parol_hash, rol) VALUES (?, ?, ?, ?)', [
      ism,
      login,
      hashPassword(parol),
      rol,
    ]);
    const user = await db.get('SELECT id, ism, login, rol, created_at FROM users WHERE id = ?', [
      info.lastInsertRowid,
    ]);
    res.status(201).json({ user });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const target = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!target) return res.status(404).json({ xato: 'Foydalanuvchi topilmadi' });

    const { ism, login, parol, rol } = req.body || {};

    if (rol && !['admin', 'sotuvchi'].includes(rol)) {
      return res.status(400).json({ xato: 'Rol noto\'g\'ri (admin yoki sotuvchi)' });
    }

    if (login && login !== target.login) {
      const exists = await db.get('SELECT id FROM users WHERE login = ? AND id != ?', [login, id]);
      if (exists) return res.status(409).json({ xato: 'Bu login band' });
    }

    const yangiIsm = ism ?? target.ism;
    const yangiLogin = login ?? target.login;
    const yangiRol = rol ?? target.rol;
    const yangiParolHash = parol ? hashPassword(parol) : target.parol_hash;

    await db.run('UPDATE users SET ism = ?, login = ?, rol = ?, parol_hash = ? WHERE id = ?', [
      yangiIsm,
      yangiLogin,
      yangiRol,
      yangiParolHash,
      id,
    ]);

    const user = await db.get('SELECT id, ism, login, rol, created_at FROM users WHERE id = ?', [id]);
    res.json({ user });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ xato: 'O\'zingizni o\'chira olmaysiz' });
    }
    const target = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!target) return res.status(404).json({ xato: 'Foydalanuvchi topilmadi' });

    if (target.rol === 'admin') {
      const row = await db.get("SELECT COUNT(*) AS soni FROM users WHERE rol = 'admin'");
      if (row.soni <= 1) {
        return res.status(400).json({ xato: 'Tizimda kamida bitta admin qolishi kerak' });
      }
    }

    await db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ ok: true });
  })
);

module.exports = router;
