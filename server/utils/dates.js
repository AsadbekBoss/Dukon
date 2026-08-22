// Kun/hafta/oy chegaralarini ISO satr shaklida qaytaradi (lokal vaqt asosida)

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Yakshanba ... 6=Shanba
  const diff = day === 0 ? 6 : day - 1; // Dushanbadan boshlanadi
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d = new Date()) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

module.exports = { startOfDay, startOfWeek, startOfMonth, addDays };
