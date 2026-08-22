const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_ozgartiring';
const TOKEN_TTL = '12h';

function hashPassword(parol) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(parol, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(parol, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(parol, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(check, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, ism: user.ism, login: user.login, rol: user.rol },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
