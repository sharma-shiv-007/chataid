// backend/routes/notifications.js
const router = require("express").Router();
const ctrl   = require("../controllers/notificationController");
const auth   = require("../middleware/auth");

router.get("/",           auth, ctrl.getMyNotifications);
router.patch("/read-all", auth, ctrl.markAllRead);
router.patch("/:id/read", auth, ctrl.markRead);

module.exports = router;