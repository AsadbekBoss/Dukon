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
    if (!req.user || !rollar.includes(req.user.rol)) {
      return res.status(403).json({ xato: 'Bu amal uchun ruxsat yo\'q' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
