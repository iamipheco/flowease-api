/* ======================================================
   src/server.js
   Main Server Entry Point
====================================================== */
import { EventEmitter } from 'events';
import mongoose from 'mongoose';
import { validateEnv, displayEnvVars } from './config/validateEnv.js';
import app from './app.js';
import connectDB from './config/db.js';
import { startReminderService, stopReminderService } from './services/reminderService.js';
import {
  handleUnhandledRejection,
  handleUncaughtException,
} from './middleware/error.js';

/* =============================
   FIX: Increase EventEmitter max listeners
============================= */
EventEmitter.defaultMaxListeners = 20; // Increased from 15 to 20

/* =============================
   UNCAUGHT EXCEPTION HANDLER
   Must be at the top
============================= */
handleUncaughtException();

/* =============================
   ENVIRONMENT VALIDATION
============================= */
validateEnv();

if (process.env.NODE_ENV === 'development') {
  console.log('\n📋 Environment Variables Loaded:');
  displayEnvVars();
}

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/* =============================
   DATABASE CONNECTION
============================= */
try {
  await connectDB();
  console.log('✅ Database connected successfully\n');
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
  process.exit(1);
}

/* =============================
   START SERVER
============================= */
const server = app.listen(PORT, () => {
  console.log(`
    ╔════════════════════════════════════════════════════╗
    ║                                                    ║
    ║     🚀 FlowEase Task Manager API                  ║
    ║                                                    ║
    ║     Environment: ${NODE_ENV.padEnd(35)}║
    ║     Port:        ${String(PORT).padEnd(35)}║
    ║     URL:         http://localhost:${PORT.toString().padEnd(23)}║
    ║                                                    ║
    ║     Status:      ✅ Running                       ║
    ║     Database:    ✅ Connected                     ║
    ║                                                    ║
    ╚════════════════════════════════════════════════════╝
  `);

  console.log('\n📋 Available Routes:');
  console.log('   🔐 Auth:          /api/auth');
  console.log('   👤 Users:         /api/users');
  console.log('   🏢 Workspaces:    /api/workspaces');
  console.log('   📁 Projects:      /api/projects');
  console.log('   ✅ Tasks:         /api/tasks');
  console.log('   📊 Sections:      /api/sections');
  console.log('   ⏱️  Time Entries:  /api/time-entries');
  console.log('   🎯 Milestones:    /api/milestones');
  console.log('   🔔 Notifications: /api/notifications');
  console.log('   ✉️  Invitations:   /api/invitations');

  console.log('\n🔧 Utilities:');
  console.log('   ❤️  Health Check:  /health');
  console.log('   📚 API Info:      /api');
  console.log('   🏠 Welcome:       /');

  // Start automated services
  console.log('\n🤖 Starting automated services...');
  startReminderService();
});

/* =============================
   GRACEFUL SHUTDOWN HANDLERS
============================= */

// Unhandled promise rejections
handleUnhandledRejection(server);

// SIGTERM signal (production/Docker)
process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM received, shutting down gracefully...');
  
  stopReminderService();
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    console.log('🔌 Closing database connection...');
    
    mongoose.connection.close(false, () => {
      console.log('✅ Database connection closed');
      console.log('👋 Process terminated gracefully');
      process.exit(0);
    });
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after 10 seconds');
    process.exit(1);
  }, 10000);
});

// SIGINT signal (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT received (Ctrl+C), shutting down gracefully...');
  
  stopReminderService();
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    console.log('🔌 Closing database connection...');
    
    mongoose.connection.close(false, () => {
      console.log('✅ Database connection closed');
      console.log('👋 Process terminated gracefully');
      process.exit(0);
    });
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after 10 seconds');
    process.exit(1);
  }, 10000);
});

/* =============================
   EXPORT SERVER (for testing)
============================= */
export default server;