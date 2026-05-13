// backend/utils/apiResponse.js
exports.success = (res, data, statusCode = 200) =>
  res.status(statusCode).json({ success: true, ...data });

exports.error = (res, message, statusCode = 400) =>
  res.status(statusCode).json({ success: false, error: message });