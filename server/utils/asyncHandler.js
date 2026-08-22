// Express route handlerlaridagi Promise xatoliklarini avtomatik next(err)ga uzatadi,
// aks holda asinxron xatolik ushlanmay qolib, so'rov "osilib qolishi" mumkin edi.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
