const { verifyToken } = require('../utils/auth');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ xato: 'Tizimga kirish talab qilinadi' });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ xato: 'Token yaroqsiz yoki muddati tugagan' });
  }
}

function requireRole(...rollar) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ xato: 'Bu amal uchun ruxsat yo\'q' });
    }
    // "dev" — tizim egasi darajasi, barcha admin/sotuvchi cheklovlarini chetlab o'tadi
    if (req.user.rol === 'dev' || rollar.includes(req.user.rol)) {
      return next();
    }
    return res.status(403).json({ xato: 'Bu amal uchun ruxsat yo\'q' });
  };
}

module.exports = { requireAuth, requireRole };
