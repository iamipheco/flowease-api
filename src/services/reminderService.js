/* ======================================================
   src/services/reminderService.js
   Enhanced Automated Task & Notification Service
====================================================== */
import cron from 'node-cron';
import Task from '../models/Task.js';
import Milestone from '../models/Milestone.js';
import TimeEntry from '../models/TimeEntry.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendNotificationEmail } from './emailService.js';

/* =============================
   TASK REMINDER CHECKER
   Runs every hour
============================= */
const checkTaskReminders = cron.schedule('0 * * * *', async () => {
  try {
    console.log('⏰ Checking for task reminders...');

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const tasks = await Task.find({
      reminderDate: { $gte: now, $lte: oneHourFromNow },
      status: { $nin: ['completed', 'cancelled'] },
      isArchived: false
    })
      .populate('assignedTo.user', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name');

    for (const task of tasks) {
      // Collect unique users to notify
      const usersToNotify = new Set();
      
      if (task.createdBy) {
        usersToNotify.add(task.createdBy._id.toString());
      }
      
      task.assignedTo.forEach(assignment => {
        if (assignment.user && assignment.status === 'accepted') {
          usersToNotify.add(assignment.user._id.toString());
        }
      });

      // Create notifications
      for (const userId of usersToNotify) {
        await Notification.createNotification({
          userId,
          type: 'task_reminder',
          title: 'Task Reminder',
          message: `Reminder: "${task.title}" is due soon`,
          relatedTask: task._id,
          relatedProject: task.project?._id,
          priority: task.priority === 'urgent' ? 'high' : 'medium',
          category: 'task'
        });

        // Send email notification if user has email notifications enabled
        const user = await User.findById(userId);
        if (user?.notificationSettings?.email?.taskReminders) {
          await sendNotificationEmail({
            email: user.email,
            name: user.name,
            title: 'Task Reminder',
            message: `Reminder: "${task.title}" is due soon.`,
            buttonText: 'View Task',
            buttonUrl: `${process.env.FRONTEND_URL}/tasks/${task._id}`
          });
        }
      }

      // Clear reminder date to prevent duplicate notifications
      task.reminderDate = null;
      task.metadata.set('reminderSent', true);
      task.metadata.set('reminderSentAt', new Date());
      await task.save({ validateBeforeSave: false });
    }

    console.log(`✅ Processed ${tasks.length} task reminder(s)`);
  } catch (error) {
    console.error('❌ Error checking task reminders:', error);
  }
});

/* =============================
   OVERDUE TASKS CHECKER
   Runs daily at midnight
============================= */
const checkOverdueTasks = cron.schedule('0 0 * * *', async () => {
  try {
    console.log('🔔 Checking for overdue tasks...');

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const tasks = await Task.find({
      dueDate: { $gte: yesterday, $lt: now },
      status: { $nin: ['completed', 'cancelled'] },
      isArchived: false
    })
      .populate('assignedTo.user', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name');

    for (const task of tasks) {
      const usersToNotify = new Set();
      
      if (task.createdBy) {
        usersToNotify.add(task.createdBy._id.toString());
      }
      
      task.assignedTo.forEach(assignment => {
        if (assignment.user && assignment.status === 'accepted') {
          usersToNotify.add(assignment.user._id.toString());
        }
      });

      // Create overdue notifications
      for (const userId of usersToNotify) {
        await Notification.createNotification({
          userId,
          type: 'task_overdue',
          title: 'Task Overdue',
          message: `Task "${task.title}" is now overdue`,
          relatedTask: task._id,
          relatedProject: task.project?._id,
          priority: 'high',
          category: 'task'
        });

        // Send email notification
        const user = await User.findById(userId);
        if (user?.notificationSettings?.email?.taskOverdue) {
          await sendNotificationEmail({
            email: user.email,
            name: user.name,
            title: 'Task Overdue',
            message: `Task "${task.title}" is now overdue. Please take action.`,
            buttonText: 'View Task',
            buttonUrl: `${process.env.FRONTEND_URL}/tasks/${task._id}`
          });
        }
      }

      // Mark as notified
      task.metadata.set('overdueNotificationSent', true);
      task.metadata.set('overdueNotificationSentAt', new Date());
      await task.save({ validateBeforeSave: false });
    }

    console.log(`✅ Processed ${tasks.length} overdue task(s)`);
  } catch (error) {
    console.error('❌ Error checking overdue tasks:', error);
  }
});

/* =============================
   UPCOMING TASK DUE SOON CHECKER
   Runs daily at 9 AM
============================= */
const checkUpcomingTasks = cron.schedule('0 9 * * *', async () => {
  try {
    console.log('📅 Checking for tasks due soon...');

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const tasks = await Task.find({
      dueDate: { $gte: now, $lte: tomorrow },
      status: { $nin: ['completed', 'cancelled'] },
      isArchived: false
    })
      .populate('assignedTo.user', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name');

    for (const task of tasks) {
      const usersToNotify = new Set();
      
      if (task.createdBy) {
        usersToNotify.add(task.createdBy._id.toString());
      }
      
      task.assignedTo.forEach(assignment => {
        if (assignment.user && assignment.status === 'accepted') {
          usersToNotify.add(assignment.user._id.toString());
        }
      });

      for (const userId of usersToNotify) {
        await Notification.createNotification({
          userId,
          type: 'task_due_soon',
          title: 'Task Due Soon',
          message: `Task "${task.title}" is due within 24 hours`,
          relatedTask: task._id,
          relatedProject: task.project?._id,
          priority: task.priority === 'urgent' ? 'high' : 'medium',
          category: 'task'
        });
      }
    }

    console.log(`✅ Processed ${tasks.length} upcoming task(s)`);
  } catch (error) {
    console.error('❌ Error checking upcoming tasks:', error);
  }
});

/* =============================
   MILESTONE DUE DATE CHECKER
   Runs daily at 8 AM
============================= */
const checkMilestoneDueDates = cron.schedule('0 8 * * *', async () => {
  try {
    console.log('🎯 Checking milestone due dates...');

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const milestones = await Milestone.find({
      dueDate: { $gte: now, $lte: threeDaysFromNow },
      status: { $nin: ['completed', 'cancelled'] },
      isArchived: false
    })
      .populate('team.user', 'name email')
      .populate('owner', 'name email')
      .populate('project', 'name');

    for (const milestone of milestones) {
      const usersToNotify = new Set();
      
      if (milestone.owner) {
        usersToNotify.add(milestone.owner._id.toString());
      }
      
      milestone.team.forEach(member => {
        if (member.user) {
          usersToNotify.add(member.user._id.toString());
        }
      });

      for (const userId of usersToNotify) {
        await Notification.createNotification({
          userId,
          type: 'milestone_due_soon',
          title: 'Milestone Due Soon',
          message: `Milestone "${milestone.title}" is due within 3 days`,
          relatedMilestone: milestone._id,
          relatedProject: milestone.project?._id,
          priority: 'high',
          category: 'project'
        });
      }
    }

    console.log(`✅ Processed ${milestones.length} milestone(s)`);
  } catch (error) {
    console.error('❌ Error checking milestone due dates:', error);
  }
});

/* =============================
   EXPIRED INVITATIONS CLEANER
   Runs daily at 2 AM
============================= */
const cleanExpiredInvitations = cron.schedule('0 2 * * *', async () => {
  try {
    console.log('🧹 Cleaning expired invitations...');

    const Invitation = (await import('../models/Invitation.js')).default;
    const result = await Invitation.cleanExpired();

    console.log(`✅ Cleaned ${result.deletedCount} expired invitation(s)`);
  } catch (error) {
    console.error('❌ Error cleaning expired invitations:', error);
  }
});

/* =============================
   OLD NOTIFICATIONS CLEANER
   Runs daily at 3 AM
============================= */
const cleanOldNotifications = cron.schedule('0 3 * * *', async () => {
  try {
    console.log('🗑️ Cleaning old notifications...');

    const result = await Notification.cleanOldNotifications(30); // Delete notifications older than 30 days

    console.log(`✅ Cleaned ${result.deletedCount} old notification(s)`);
  } catch (error) {
    console.error('❌ Error cleaning old notifications:', error);
  }
});

/* =============================
   RUNNING TIMER AUTO-STOP
   Runs every 15 minutes
============================= */
const checkRunningTimers = cron.schedule('*/15 * * * *', async () => {
  try {
    console.log('⏱️ Checking for running timers...');

    const now = new Date();
    const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);

    // Find timers running for more than 8 hours
    const longRunningTimers = await TimeEntry.find({
      isRunning: true,
      clockIn: { $lte: eightHoursAgo }
    }).populate('user', 'name email');

    for (const timer of longRunningTimers) {
      // Auto-stop timer
      await timer.stop();
      timer.autoStop = {
        enabled: true,
        stoppedAt: new Date(),
        reason: 'Auto-stopped after 8 hours'
      };
      await timer.save({ validateBeforeSave: false });

      // Notify user
      await Notification.createNotification({
        userId: timer.user._id,
        type: 'time_entry_auto_stopped',
        title: 'Timer Auto-Stopped',
        message: 'Your timer was automatically stopped after running for 8 hours',
        category: 'time_tracking',
        priority: 'medium'
      });
    }

    if (longRunningTimers.length > 0) {
      console.log(`✅ Auto-stopped ${longRunningTimers.length} timer(s)`);
    }
  } catch (error) {
    console.error('❌ Error checking running timers:', error);
  }
});

/* =============================
   DAILY DIGEST EMAIL
   Runs daily at 7 AM
============================= */
const sendDailyDigest = cron.schedule('0 7 * * *', async () => {
  try {
    console.log('📧 Sending daily digest emails...');

    const users = await User.find({
      'notificationSettings.email.dailyDigest': true,
      isActive: true,
      isDeleted: false
    });

    for (const user of users) {
      // Get user's tasks due today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const tasksDueToday = await Task.countDocuments({
        'assignedTo.user': user._id,
        'assignedTo.status': 'accepted',
        dueDate: { $gte: today, $lt: tomorrow },
        status: { $nin: ['completed', 'cancelled'] },
        isArchived: false
      });

      const overdueTasks = await Task.countDocuments({
        'assignedTo.user': user._id,
        'assignedTo.status': 'accepted',
        dueDate: { $lt: today },
        status: { $nin: ['completed', 'cancelled'] },
        isArchived: false
      });

      if (tasksDueToday > 0 || overdueTasks > 0) {
        await sendNotificationEmail({
          email: user.email,
          name: user.name,
          title: 'Daily Task Digest',
          message: `You have ${tasksDueToday} task(s) due today and ${overdueTasks} overdue task(s).`,
          buttonText: 'View My Tasks',
          buttonUrl: `${process.env.FRONTEND_URL}/tasks/my-tasks`
        });
      }
    }

    console.log(`✅ Sent daily digest to ${users.length} user(s)`);
  } catch (error) {
    console.error('❌ Error sending daily digest:', error);
  }
});

/* =============================
   SERVICE CONTROL
============================= */
export const startReminderService = () => {
  checkTaskReminders.start();
  checkOverdueTasks.start();
  checkUpcomingTasks.start();
  checkMilestoneDueDates.start();
  cleanExpiredInvitations.start();
  cleanOldNotifications.start();
  checkRunningTimers.start();
  sendDailyDigest.start();
  
  console.log('✅ All automated services started successfully');
  console.log('📋 Active services:');
  console.log('   - Task reminders (hourly)');
  console.log('   - Overdue tasks (daily at midnight)');
  console.log('   - Upcoming tasks (daily at 9 AM)');
  console.log('   - Milestone due dates (daily at 8 AM)');
  console.log('   - Expired invitations cleanup (daily at 2 AM)');
  console.log('   - Old notifications cleanup (daily at 3 AM)');
  console.log('   - Running timer auto-stop (every 15 minutes)');
  console.log('   - Daily digest emails (daily at 7 AM)');
};

export const stopReminderService = () => {
  checkTaskReminders.stop();
  checkOverdueTasks.stop();
  checkUpcomingTasks.stop();
  checkMilestoneDueDates.stop();
  cleanExpiredInvitations.stop();
  cleanOldNotifications.stop();
  checkRunningTimers.stop();
  sendDailyDigest.stop();
  
  console.log('🛑 All automated services stopped');
};