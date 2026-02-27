/* ======================================================
   src/middleware/error.js
   Enhanced Global Error Handler
====================================================== */
import { v4 as uuidv4 } from 'uuid';

/*
|--------------------------------------------------------------------------
| Custom Error Class
|--------------------------------------------------------------------------
*/
export class ErrorResponse extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true; // Distinguishes operational errors from programming errors
    
    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/*
|--------------------------------------------------------------------------
| Request ID Middleware (for tracking errors)
|--------------------------------------------------------------------------
*/
export const requestId = (req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
};

/*
|--------------------------------------------------------------------------
| Global Error Handler Middleware
|--------------------------------------------------------------------------
*/
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.errorCode = err.errorCode || null;

  // Log errors
  logError(err, req);

  /*
  |--------------------------------------------------------------------------
  | MONGOOSE ERRORS
  |--------------------------------------------------------------------------
  */

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found`;
    error = new ErrorResponse(message, 404, 'RESOURCE_NOT_FOUND');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `${capitalizeFirst(field)} '${value}' already exists`;
    error = new ErrorResponse(message, 400, 'DUPLICATE_FIELD');
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    const message = messages.length === 1 ? messages[0] : messages;
    error = new ErrorResponse(message, 400, 'VALIDATION_ERROR');
  }

  /*
  |--------------------------------------------------------------------------
  | JWT ERRORS
  |--------------------------------------------------------------------------
  */

  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please login again';
    error = new ErrorResponse(message, 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Your session has expired. Please login again';
    error = new ErrorResponse(message, 401, 'TOKEN_EXPIRED');
  }

  /*
  |--------------------------------------------------------------------------
  | MULTER ERRORS (File Upload)
  |--------------------------------------------------------------------------
  */

  if (err.name === 'MulterError') {
    let message = 'File upload error';
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size too large. Maximum size is 10MB';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files. Maximum is 5 files';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected field name in file upload';
    }
    
    error = new ErrorResponse(message, 400, 'FILE_UPLOAD_ERROR');
  }

  /*
  |--------------------------------------------------------------------------
  | MONGOOSE CONNECTION ERRORS
  |--------------------------------------------------------------------------
  */

  if (err.name === 'MongoNetworkError') {
    const message = 'Database connection error. Please try again';
    error = new ErrorResponse(message, 503, 'DATABASE_CONNECTION_ERROR');
  }

  if (err.name === 'MongoTimeoutError') {
    const message = 'Database timeout. Please try again';
    error = new ErrorResponse(message, 504, 'DATABASE_TIMEOUT');
  }

  /*
  |--------------------------------------------------------------------------
  | SYNTAX ERRORS
  |--------------------------------------------------------------------------
  */

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    const message = 'Invalid JSON payload';
    error = new ErrorResponse(message, 400, 'INVALID_JSON');
  }

  /*
  |--------------------------------------------------------------------------
  | CLOUDINARY ERRORS
  |--------------------------------------------------------------------------
  */

  if (err.name === 'CloudinaryError') {
    const message = 'File upload service error. Please try again';
    error = new ErrorResponse(message, 500, 'CLOUDINARY_ERROR');
  }

  /*
  |--------------------------------------------------------------------------
  | RATE LIMIT ERRORS
  |--------------------------------------------------------------------------
  */

  if (err.name === 'TooManyRequestsError') {
    const message = 'Too many requests. Please try again later';
    error = new ErrorResponse(message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  /*
  |--------------------------------------------------------------------------
  | BUILD ERROR RESPONSE
  |--------------------------------------------------------------------------
  */

  const response = {
    success: false,
    message: error.message,
    requestId: req.id,
    ...(error.errorCode && { errorCode: error.errorCode }),
  };

  // Development-only details
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.error = err;
  }

  // Production - sanitize error messages
  if (process.env.NODE_ENV === 'production') {
    // Don't expose internal error details in production
    if (error.statusCode === 500 && !error.isOperational) {
      response.message = 'Something went wrong. Please try again later';
    }
  }

  /*
  |--------------------------------------------------------------------------
  | SEND RESPONSE
  |--------------------------------------------------------------------------
  */

  res.status(error.statusCode).json(response);
};

/*
|--------------------------------------------------------------------------
| 404 NOT FOUND HANDLER
|--------------------------------------------------------------------------
*/
export const notFound = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  next(new ErrorResponse(message, 404, 'ROUTE_NOT_FOUND'));
};

/*
|--------------------------------------------------------------------------
| ASYNC HANDLER (Catches async errors automatically)
|--------------------------------------------------------------------------
*/
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/*
|--------------------------------------------------------------------------
| HELPER FUNCTIONS
|--------------------------------------------------------------------------
*/

// Capitalize first letter
const capitalizeFirst = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Log error with details
const logError = (err, req) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  // Console log in development
  if (isDevelopment) {
    console.error('╔════════════════════════════════════════════════════════════');
    console.error('║ ERROR DETAILS');
    console.error('╠════════════════════════════════════════════════════════════');
    console.error('║ Request ID:', req.id);
    console.error('║ Method:', req.method);
    console.error('║ URL:', req.originalUrl);
    console.error('║ IP:', req.ip);
    console.error('║ User:', req.user ? req.user._id : 'Not authenticated');
    console.error('║ Error Name:', err.name);
    console.error('║ Error Message:', err.message);
    console.error('║ Status Code:', err.statusCode || 500);
    console.error('║ Error Code:', err.errorCode || 'N/A');
    console.error('╠════════════════════════════════════════════════════════════');
    console.error('║ STACK TRACE');
    console.error('╠════════════════════════════════════════════════════════════');
    console.error(err.stack);
    console.error('╚════════════════════════════════════════════════════════════\n');
  }

  // Production logging (you can send to external service like Sentry, LogRocket, etc.)
  if (isProduction) {
    // Only log non-operational errors in production
    if (!err.isOperational) {
      console.error({
        timestamp: new Date().toISOString(),
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userId: req.user?._id,
        error: {
          name: err.name,
          message: err.message,
          statusCode: err.statusCode,
          errorCode: err.errorCode,
          stack: err.stack,
        },
      });

      // TODO: Send to external error tracking service
      // Example: Sentry.captureException(err);
    }
  }
};

/*
|--------------------------------------------------------------------------
| UNHANDLED REJECTION HANDLER
|--------------------------------------------------------------------------
*/
export const handleUnhandledRejection = (server) => {
  process.on('unhandledRejection', (err) => {
    console.error('╔════════════════════════════════════════════════════════════');
    console.error('║ UNHANDLED PROMISE REJECTION! Shutting down...');
    console.error('╠════════════════════════════════════════════════════════════');
    console.error(err.name, err.message);
    console.error('╚════════════════════════════════════════════════════════════\n');
    
    // Close server & exit process
    server.close(() => {
      process.exit(1);
    });
  });
};

/*
|--------------------------------------------------------------------------
| UNCAUGHT EXCEPTION HANDLER
|--------------------------------------------------------------------------
*/
export const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    console.error('╔════════════════════════════════════════════════════════════');
    console.error('║ UNCAUGHT EXCEPTION! Shutting down...');
    console.error('╠════════════════════════════════════════════════════════════');
    console.error(err.name, err.message);
    console.error('╚════════════════════════════════════════════════════════════\n');
    
    // Exit immediately
    process.exit(1);
  });
};

/*
|--------------------------------------------------------------------------
| VALIDATION ERROR FORMATTER
|--------------------------------------------------------------------------
*/
export const formatValidationErrors = (errors) => {
  const formatted = {};
  
  errors.array().forEach((err) => {
    if (!formatted[err.path]) {
      formatted[err.path] = err.msg;
    }
  });
  
  return formatted;
};

/*
|--------------------------------------------------------------------------
| COMMON ERROR RESPONSES
|--------------------------------------------------------------------------
*/
export const commonErrors = {
  notFound: (resource = 'Resource') => 
    new ErrorResponse(`${resource} not found`, 404, 'NOT_FOUND'),
  
  unauthorized: (message = 'Not authorized to access this resource') => 
    new ErrorResponse(message, 403, 'UNAUTHORIZED'),
  
  unauthenticated: (message = 'Please login to access this resource') => 
    new ErrorResponse(message, 401, 'UNAUTHENTICATED'),
  
  badRequest: (message = 'Bad request') => 
    new ErrorResponse(message, 400, 'BAD_REQUEST'),
  
  conflict: (message = 'Resource already exists') => 
    new ErrorResponse(message, 409, 'CONFLICT'),
  
  tooManyRequests: (message = 'Too many requests. Please try again later') => 
    new ErrorResponse(message, 429, 'TOO_MANY_REQUESTS'),
  
  serverError: (message = 'Internal server error') => 
    new ErrorResponse(message, 500, 'INTERNAL_SERVER_ERROR'),
};