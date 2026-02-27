/* ======================================================
   src/middleware/upload.js
   File Upload with Cloudinary
====================================================== */
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';
import { ErrorResponse } from './error.js';

// Profile image storage
const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const workspaceId = req.workspace?._id || 'default';
    return {
      folder: `flowease/${workspaceId}/profiles`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }],
      public_id: `user-${req.user._id}-${Date.now()}`,
    };
  },
});

// Task attachment storage
const attachmentStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const workspaceId = req.workspace?._id || 'default';
    return {
      folder: `flowease/${workspaceId}/attachments`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'xls', 'xlsx'],
      resource_type: 'auto',
    };
  },
});

// File filter
const fileFilter = (allowedTypes) => (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ErrorResponse(`File type ${file.mimetype} is not allowed`, 400), false);
  }
};

// Profile upload
export const uploadProfile = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: fileFilter(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
}).single('avatar');

// Attachment upload
export const uploadAttachment = multer({
  storage: attachmentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
}).single('file');

// Multiple attachments
export const uploadMultipleAttachments = multer({
  storage: attachmentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5, // Max 5 files
  },
}).array('files', 5);

// Error handler for multer
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 10MB',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 5 files',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next(err);
};