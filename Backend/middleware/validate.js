// backend/middleware/validate.js
exports.requireFields = (...fields) => (req, res, next) => {
  const missing = fields.filter(f => !req.body[f]?.toString().trim());
  if (missing.length) {
    return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });
  }
  next();
};