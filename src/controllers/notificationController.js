/* ======================================================
   src/controllers/notificationController.js
   Complete Notification Management Controller
====================================================== */
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { ErrorResponse } from '../middleware/error.js';
import asyncHandler from 'express-async-handler';

/* =============================
   HELPER FUNCTIONS
============================= */
const validateObjectId = (id, fieldName = 'ID') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ErrorResponse(`Invalid ${fieldName}`, 400);
  }
};

/* =============================
   @desc    Get all notifications
   @route   GET /api/notifications
   @access  Private
============================= */
export const getNotifications = asyncHandler(async (req, res) => {
  const {
    includeRead = 'true',
    category,
    type,
    priority,
    page = 1,
    limit = 20
  } = req.query;
  
  const query = {
    user: req.user._id,
    isDeleted: false
  };
  
  // Filter by read status
  if (includeRead !== 'true') {
    query.isRead = false;
  }
  
  // Filter by category
  if (category) {
    query.category = category;
  }
  
  // Filter by type
  if (type) {
    query.type = type;
  }
  
  // Filter by priority
  if (priority) {
    query.priority = priority;
  }
  
  // Pagination
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;
  
  // Fetch notifications
  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('actor', 'name profile.image')
      .populate('relatedTask', 'title status')
      .populate('relatedProject', 'name icon color')
      .populate('relatedUser', 'name profile.image')
      .lean(),
    Notification.countDocuments(query)
  ]);
  
  res.status(200).json({
    success: true,
    message: 'Notifications fetched successfully',
    count: notifications.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    data: notifications
  });
});

/* =============================
   @desc    Get unread count
   @route   GET /api/notifications/unread-count
   @access  Private
============================= */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.getUnreadCount(req.user._id);
  
  res.status(200).json({
    success: true,
    message: 'Unread notifications count fetched',
    data: { count }
  });
});

/* =============================
   @desc    Get notifications by category
   @route   GET /api/notifications/category/:category
   @access  Private
============================= */
export const getByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const { limit = 20 } = req.query;
  
  const notifications = await Notification.getByCategory(
    req.user._id,
    category,
    parseInt(limit)
  );
  
  res.status(200).json({
    success: true,
    count: notifications.length,
    data: notifications
  });
});

/* =============================
   @desc    Mark notification as read
   @route   PUT /api/notifications/:id/read
   @access  Private
============================= */
export const markAsRead = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'notification');
  
  const notification = await Notification.findOne({
    _id: req.params.id,
    user: req.user._id,
    isDeleted: false
  });
  
  if (!notification) {
    throw new ErrorResponse('Notification not found', 404);
  }
  
  await notification.markAsRead();
  
  res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: notification
  });
});

/* =============================
   @desc    Mark notification as unread
   @route   PUT /api/notifications/:id/unread
   @access  Private
============================= */
export const markAsUnread = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'notification');
  
  const notification = await Notification.findOne({
    _id: req.params.id,
    user: req.user._id,
    isDeleted: false
  });
  
  if (!notification) {
    throw new ErrorResponse('Notification not found', 404);
  }
  
  await notification.markAsUnread();
  
  res.status(200).json({
    success: true,
    message: 'Notification marked as unread',
    data: notification
  });
});

/* =============================
   @desc    Mark all as read
   @route   PUT /api/notifications/mark-all-read
   @access  Private
============================= */
export const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.markAllAsRead(req.user._id);
  
  res.status(200).json({
    success: true,
    message: 'All notifications marked as read'
  });
});

/* =============================
   @desc    Delete notification
   @route   DELETE /api/notifications/:id
   @access  Private
============================= */
export const deleteNotification = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'notification');
  
  const notification = await Notification.findOne({
    _id: req.params.id,
    user: req.user._id
  });
  
  if (!notification) {
    throw new ErrorResponse('Notification not found', 404);
  }
  
  await notification.softDelete();
  
  res.status(200).json({
    success: true,
    message: 'Notification deleted successfully'
  });
});

/* =============================
   @desc    Delete all read notifications
   @route   DELETE /api/notifications/clear-read
   @access  Private
============================= */
export const clearReadNotifications = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    {
      user: req.user._id,
      isRead: true,
      isDeleted: false
    },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date()
      }
    }
  );
  
  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} read notifications cleared`
  });
});

/* =============================
   @desc    Get notification settings
   @route   GET /api/notifications/settings
   @access  Private
============================= */
export const getNotificationSettings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('notificationSettings');
  
  res.status(200).json({
    success: true,
    data: user.notificationSettings
  });
});

/* =============================
   @desc    Update notification settings
   @route   PUT /api/notifications/settings
   @access  Private
============================= */
export const updateNotificationSettings = asyncHandler(async (req, res) => {
  const { notificationSettings } = req.body;
  
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { notificationSettings } },
    { new: true, runValidators: true }
  ).select('notificationSettings');
  
  res.status(200).json({
    success: true,
    message: 'Notification settings updated successfully',
    data: user.notificationSettings
  });
});