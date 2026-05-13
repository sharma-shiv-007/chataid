// backend/controllers/notificationController.js
const Notification = require("../models/notification");
const catchAsync   = require("../utils/catchAsync");

// GET /api/notifications
exports.getMyNotifications = catchAsync(async (req, res) => {
  const notifications = await Notification.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ notifications });
});

// PATCH /api/notifications/:id/read
exports.markRead = catchAsync(async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
  res.json({ success: true });
});

// PATCH /api/notifications/read-all
exports.markAllRead = catchAsync(async (req, res) => {
  await Notification.updateMany({ userId: req.user.id }, { isRead: true });
  res.json({ success: true });
});