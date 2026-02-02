const multer = require('multer');
const path = require('path');
const fs = require('fs');
const constants = require('./constants');

/**
 * Create directory if it doesn't exist
 */
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Generate unique filename
 */
const generateFilename = (originalName, prefix = 'file') => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext)
    .replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')
    .substring(0, 50); // Limit name length
  return `${prefix}_${timestamp}_${random}_${name}${ext}`;
};

/**
 * File filter factory for different file types
 */
const createFileFilter = (allowedTypes, maxSize) => {
  return (req, file, cb) => {
    // Check file type
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (!mimetype || !extname) {
      const error = new Error(`Only ${allowedTypes.toString()} files are allowed`);
      error.code = 'INVALID_FILE_TYPE';
      return cb(error, false);
    }

    // Check file size
    if (maxSize && file.size > maxSize) {
      const error = new Error(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
      error.code = 'LIMIT_FILE_SIZE';
      return cb(error, false);
    }

    cb(null, true);
  };
};

/**
 * Storage configuration for ID photos
 */
const idPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', constants.PATHS.ID_PHOTOS);
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const filename = generateFilename(file.originalname, 'id');
    cb(null, filename);
  }
});

/**
 * Storage configuration for maps
 */
const mapStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', constants.PATHS.MAPS);
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const filename = generateFilename(file.originalname, 'map');
    cb(null, filename);
  }
});

/**
 * Create upload middleware with specific configuration
 */
const createUploadMiddleware = (storage, fileFilter, limits) => {
  return multer({
    storage,
    fileFilter,
    limits
  });
};

/**
 * ID photo upload middleware
 */
const uploadIdPhoto = createUploadMiddleware(
  idPhotoStorage,
  createFileFilter(constants.ALLOWED_FILE_TYPES.IMAGES, constants.UPLOAD_LIMITS.ID_PHOTO),
  { fileSize: constants.UPLOAD_LIMITS.ID_PHOTO }
);

/**
 * Map file upload middleware
 */
const uploadMap = createUploadMiddleware(
  mapStorage,
  createFileFilter(constants.ALLOWED_FILE_TYPES.MAPS, constants.UPLOAD_LIMITS.MAP_FILE),
  { fileSize: constants.UPLOAD_LIMITS.MAX_FILE_SIZE }
);

/**
 * Multiple file upload for maps (if needed)
 */
const uploadMaps = uploadMap.array('files', 5); // Max 5 files

/**
 * Single file upload for any type (generic)
 */
const uploadSingle = (options = {}) => {
  const {
    allowedTypes = constants.ALLOWED_FILE_TYPES.MAPS,
    maxSize = constants.UPLOAD_LIMITS.MAX_FILE_SIZE,
    fieldName = 'file',
    maxCount = 1
  } = options;

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '..', '..', constants.PATHS.UPLOADS);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const filename = generateFilename(file.originalname, 'upload');
      cb(null, filename);
    }
  });

  const upload = createUploadMiddleware(
    storage,
    createFileFilter(allowedTypes, maxSize),
    { fileSize: maxSize }
  );

  return maxCount > 1 ? upload.array(fieldName, maxCount) : upload.single(fieldName);
};

/**
 * Get file path for database storage
 */
const getFilePathForDB = (file, category = 'uploads') => {
  if (!file) return null;
  
  const filename = path.basename(file.path);
  return `/${constants.PATHS[category.toUpperCase()]}/${filename}`;
};

/**
 * Delete uploaded file
 */
const deleteUploadedFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

/**
 * Clean up temporary files middleware
 */
const cleanupTempFiles = (req, res, next) => {
  // Store reference to files for cleanup
  const filesToCleanup = [];

  // If there are uploaded files, store their paths
  if (req.file) {
    filesToCleanup.push(req.file.path);
  }
  if (req.files && Array.isArray(req.files)) {
    req.files.forEach(file => filesToCleanup.push(file.path));
  }

  // Cleanup on response finish
  res.on('finish', () => {
    filesToCleanup.forEach(filePath => {
      if (req.fileError) {
        deleteUploadedFile(filePath);
      }
    });
  });

  next();
};

/**
 * Validate uploaded file
 */
const validateFile = (file, options = {}) => {
  const {
    required = true,
    allowedTypes = constants.ALLOWED_FILE_TYPES.MAPS,
    maxSize = constants.UPLOAD_LIMITS.MAX_FILE_SIZE
  } = options;

  if (required && !file) {
    return { valid: false, error: 'File is required' };
  }

  if (file) {
    // Check file size
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit` 
      };
    }

    // Check file type
    const extname = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (!allowedTypes.test(extname) || !allowedTypes.test(file.mimetype)) {
      return { 
        valid: false, 
        error: `File type not allowed. Allowed types: ${allowedTypes}` 
      };
    }
  }

  return { valid: true };
};

module.exports = {
  // Upload middleware instances
  uploadIdPhoto,
  uploadMap,
  uploadMaps,
  uploadSingle,
  
  // Utility functions
  getFilePathForDB,
  deleteUploadedFile,
  cleanupTempFiles,
  validateFile,
  generateFilename,
  ensureDir,
  
  // Re-export constants for convenience
  ...constants
};