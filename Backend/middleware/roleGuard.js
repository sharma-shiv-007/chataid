// backend/middleware/roleGuard.js
const allow = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Not authorized." });
  }
  next();
};
module.exports = allow;