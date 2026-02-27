/* ======================================================
   src/routes/notificationRoutes.js
   Notification Management Routes
====================================================== */
import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  getByCategory,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
  getNotificationSettings,
  updateNotificationSettings,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js';
import { idValidation } from '../middleware/validation.js';

const router = express.Router();

/* =============================
   ALL ROUTES REQUIRE AUTHENTICATION
============================= */
router.use(protect);

/* =============================
   NOTIFICATION LISTS
============================= */

// Get All Notifications (with filters)
router.get('/', getNotifications);

// Get Unread Count
router.get('/unread-count', getUnreadCount);

// Get by Category
router.get('/category/:category', getByCategory);

/* =============================
   NOTIFICATION SETTINGS
============================= */

// Get & Update Settings
router
  .route('/settings')
  .get(getNotificationSettings)
  .put(updateNotificationSettings);

/* =============================
   BULK OPERATIONS
============================= */

// Mark All as Read
router.put('/mark-all-read', markAllAsRead);

// Clear Read Notifications
router.delete('/clear-read', clearReadNotifications);

/* =============================
   SINGLE NOTIFICATION OPERATIONS
============================= */

// Mark as Read
router.put('/:id/read', idValidation, markAsRead);

// Mark as Unread
router.put('/:id/unread', idValidation, markAsUnread);

// Delete Notification
router.delete('/:id', idValidation, deleteNotification);

export default router;