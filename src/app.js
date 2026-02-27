/* ======================================================
   src/app.js
   Main Express Application Setup
====================================================== */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import path from 'path';
import { fileURLToPath } from 'url';

import { errorHandler, notFound, requestId } from './middleware/error.js';
import passport from './config/passport.js';
import { apiLimiter } from './middleware/rateLimit.js';

// Import ALL routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import workspaceRoutes from './routes/workspaceRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import sectionRoutes from './routes/sectionRoutes.js';
import timeEntryRoutes from './routes/timeEntryRoutes.js';
import milestoneRoutes from './routes/milestoneRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';

const app = express();

/* =============================
   SECURITY & TRUST
============================= */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('trust proxy', 1); // Trust first proxy

/* =============================
   REQUEST ID (for tracking)
============================= */
app.use(requestId);

/* =============================
   SESSION CONFIGURATION
   ⚠️ IMPORTANT: Only create session if MONGODB_URI exists
============================= */
if (process.env.MONGODB_URI) {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        touchAfter: 24 * 3600, // Lazy session update
        crypto: {
          secret: process.env.SESSION_SECRET || 'session-secret-key'
        }
      }),
      cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      },
    })
  );
} else {
  // Fallback to memory store (development only - not recommended for production)
  console.warn('⚠️  WARNING: Using memory session store. Set MONGODB_URI for production!');
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );
}

/* =============================
   PASSPORT INITIALIZATION
============================= */
app.use(passport.initialize());
app.use(passport.session());

/* =============================
   CORS CONFIGURATION
============================= */
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',') 
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })
);

/* =============================
   BODY PARSERS
============================= */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* =============================
   LOGGING
============================= */
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

/* =============================
   RATE LIMITING
============================= */
app.use('/api/', apiLimiter);

/* =============================
   HEALTH CHECK
============================= */
app.get('/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    environment: process.env.NODE_ENV,
    database: 'disconnected',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
    },
  };

  try {
    const mongoose = await import('mongoose');
    await mongoose.default.connection.db.admin().ping();
    health.database = 'connected';
    health.databaseName = mongoose.default.connection.name;
    res.status(200).json(health);
  } catch (error) {
    health.database = 'disconnected';
    health.error = error.message;
    res.status(503).json(health);
  }
});

/* =============================
   API ROUTES
============================= */
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/invitations', invitationRoutes);

/* =============================
   API DOCUMENTATION ROUTE
============================= */
app.get('/api/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

/* =============================
   WELCOME ROUTE
============================= */
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to FlowEase Task Manager API',
    version: '2.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      workspaces: '/api/workspaces',
      projects: '/api/projects',
      tasks: '/api/tasks',
      sections: '/api/sections',
      timeEntries: '/api/time-entries',
      milestones: '/api/milestones',
      notifications: '/api/notifications',
      invitations: '/api/invitations',
    },
    features: [
      'Multi-workspace support',
      'Advanced task management',
      'Time tracking with approval workflow',
      'Milestone tracking',
      'Real-time notifications',
      'OAuth authentication (Google, LinkedIn)',
      'Email notifications',
      'Automated reminders',
      'Kanban boards with WIP limits',
      'Team collaboration',
    ],
  });
});

/* =============================
   API INFO ROUTE
============================= */
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    api: 'FlowEase Task Manager API',
    version: '2.0.0',
    status: 'active',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/* =============================
   404 HANDLER (must be after all routes)
============================= */
app.use(notFound);

/* =============================
   GLOBAL ERROR HANDLER (must be last)
============================= */
app.use(errorHandler);

export default app;