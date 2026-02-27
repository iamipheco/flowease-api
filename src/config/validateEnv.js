/**
 * ============================================
 * Environment Variables Validation
 * ============================================
 * Validates all required environment variables on startup
 * Exits process if any critical variables are missing
 */

/**
 * Required environment variables grouped by category
 */
const envConfig = {
  // Server Configuration
  server: {
    PORT: { required: false, default: 5000 },
    NODE_ENV: { required: false, default: 'development' },
  },

  // Database
  database: {
    MONGO_URI: { required: true },
  },

  // JWT Authentication
  jwt: {
    JWT_SECRET: { required: true, minLength: 32 },
    JWT_EXPIRE: { required: false, default: '15m' },
    JWT_REFRESH_SECRET: { required: true, minLength: 32 },
    JWT_REFRESH_EXPIRE: { required: false, default: '7d' },
  },

  // OAuth - Google
  googleOAuth: {
    GOOGLE_CLIENT_ID: { required: true },
    GOOGLE_CLIENT_SECRET: { required: true },
  },

  // OAuth - LinkedIn
  linkedinOAuth: {
    LINKEDIN_CLIENT_ID: { required: true },
    LINKEDIN_CLIENT_SECRET: { required: true },
  },

  // Session
  session: {
    SESSION_SECRET: { required: true, minLength: 32 },
  },

  // Cloudinary
  cloudinary: {
    CLOUDINARY_CLOUD_NAME: { required: true },
    CLOUDINARY_API_KEY: { required: true },
    CLOUDINARY_API_SECRET: { required: true },
  },

  // Email Service
  email: {
    EMAIL_HOST: { required: false, default: 'smtp.ethereal.email' },
    EMAIL_PORT: { required: false, default: 587 },
    EMAIL_USER: { required: false },
    EMAIL_PASS: { required: false },
    FROM_NAME: { required: false, default: 'FlowEase Task Manager' },
    FROM_EMAIL: { required: false, default: 'noreply@flowease.com' },
  },

  // Frontend
  frontend: {
    FRONTEND_URL: { required: true },
  },

  // Rate Limiting
  rateLimiting: {
    RATE_LIMIT_WINDOW_MS: { required: false, default: 900000 },
    RATE_LIMIT_MAX_REQUESTS: { required: false, default: 100 },
  },

  // App Branding (Optional)
  branding: {
    APP_NAME: { required: false, default: 'FlowEase App' },
    APP_FULL_NAME: { required: false, default: 'FlowEase Manager' },
    SUPPORT_EMAIL: { required: false, default: 'support@flowease.com' },
  },
};

/**
 * Validate environment variables
 */
export const validateEnv = () => {
  console.log('🔍 Validating environment variables...\n');

  const errors = [];
  const warnings = [];
  const applied = [];

  // Check each category
  Object.entries(envConfig).forEach(([category, variables]) => {
    console.log(`📦 ${category.toUpperCase()}:`);

    Object.entries(variables).forEach(([key, config]) => {
      const value = process.env[key];

      // Check if required variable is missing
      if (config.required && !value) {
        errors.push(`${key} (${category})`);
        console.log(`   ❌ ${key}: MISSING (required)`);
        return;
      }

      // Apply default if missing
      if (!value && config.default !== undefined) {
        process.env[key] = String(config.default);
        applied.push(`${key} = ${config.default}`);
        console.log(`   ⚙️  ${key}: Using default (${config.default})`);
        return;
      }

      // Check minimum length if specified
      if (value && config.minLength && value.length < config.minLength) {
        warnings.push(
          `${key} should be at least ${config.minLength} characters (current: ${value.length})`
        );
        console.log(
          `   ⚠️  ${key}: Too short (${value.length} chars, recommended: ${config.minLength}+)`
        );
        return;
      }

      // Variable is present and valid
      if (value) {
        console.log(`   ✅ ${key}: Set`);
      }
    });

    console.log(''); // Empty line between categories
  });

  // Show summary
  if (applied.length > 0) {
    console.log('⚙️  Applied Defaults:');
    applied.forEach((item) => console.log(`   ${item}`));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach((warning) => console.log(`   ${warning}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.error('❌ VALIDATION FAILED - Missing required variables:\n');
    errors.forEach((error) => console.error(`   - ${error}`));
    console.error('\n💡 Please check your .env file and add the missing variables.\n');
    process.exit(1);
  }

  console.log('✅ All required environment variables are present!\n');
};

/**
 * Validate specific variable format
 */
export const validateFormat = {
  /**
   * Check if email format is valid
   */
  email: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Check if URL format is valid
   */
  url: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Check if MongoDB URI format is valid
   */
  mongoUri: (uri) => {
    return uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://');
  },
};

/**
 * Get environment-specific configuration
 */
export const getEnvConfig = () => {
  return {
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
    port: parseInt(process.env.PORT) || 5000,
    mongoUri: process.env.MONGO_URI,
    frontendUrl: process.env.FRONTEND_URL,
  };
};

/**
 * Mask sensitive values for logging
 */
export const maskSensitive = (key, value) => {
  const sensitiveKeys = [
    'PASSWORD',
    'SECRET',
    'API_KEY',
    'API_SECRET',
    'CLIENT_SECRET',
    'MONGO_URI',
  ];

  const isSensitive = sensitiveKeys.some((sensitive) =>
    key.toUpperCase().includes(sensitive)
  );

  if (!isSensitive) return value;
  if (!value) return 'NOT_SET';

  // Show first 4 and last 4 characters
  if (value.length > 12) {
    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
  }

  return '***';
};

/**
 * Display all environment variables (masked)
 */
export const displayEnvVars = () => {
  console.log('\n📋 Environment Variables (sensitive values masked):\n');

  Object.entries(envConfig).forEach(([category, variables]) => {
    console.log(`${category.toUpperCase()}:`);
    Object.keys(variables).forEach((key) => {
      const value = process.env[key];
      console.log(`  ${key}: ${maskSensitive(key, value)}`);
    });
    console.log('');
  });
};

export default validateEnv;