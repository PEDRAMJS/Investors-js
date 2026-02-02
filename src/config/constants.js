/**
 * Application constants and configuration
 */

module.exports = {
  // File upload limits (in bytes)
  UPLOAD_LIMITS: {
    ID_PHOTO: 2 * 1024 * 1024, // 2MB
    MAP_FILE: 5 * 1024 * 1024, // 5MB
    MAX_FILE_SIZE: 20 * 1024 * 1024 // 20MB (absolute max)
  },

  // Allowed file types
  ALLOWED_FILE_TYPES: {
    IMAGES: /jpeg|jpg|png|gif|bmp|webp/i,
    DOCUMENTS: /pdf/i,
    ARCHIVES: /zip|rar/i,
    MAPS: /jpeg|jpg|png|gif|bmp|webp|pdf|zip|rar/i
  },

  // File MIME types
  MIME_TYPES: {
    JPEG: 'image/jpeg',
    JPG: 'image/jpeg',
    PNG: 'image/png',
    GIF: 'image/gif',
    BMP: 'image/bmp',
    WEBP: 'image/webp',
    PDF: 'application/pdf',
    ZIP: 'application/zip',
    RAR: 'application/x-rar-compressed'
  },

  // User roles
  ROLES: {
    USER: 'user',
    AGENT: 'agent',
    ADMIN: 'admin'
  },

  // User status
  USER_STATUS: {
    PENDING: 0,
    APPROVED: 1,
    REJECTED: 2
  },

  // Estate types
  ESTATE_TYPES: [
    'مسکن مهر',
    'شخصی ساز',
    'مشاعی',
    'تعاونی',
    'خصوصی'
  ],

  // Estate deed types
  DEED_TYPES: [
    '۵ برگ',
    'تعاونی',
    'قراردادی',
    'سند رسمی',
    'سند شورایی'
  ],

  // Occupancy status
  OCCUPANCY_STATUS: [
    'تخلیه',
    'مستاجر ساکن',
    'مالک ساکن',
    'خالی از سکنه'
  ],

  // Estate features categories
  FEATURES: {
    HEATING: ['شوفاژ', 'بخاری', 'پکیج', 'موتورخانه', 'چیلر'],
    COOLING: ['کولر آبی', 'کولر گازی', 'اسپلیت', 'چیلر', 'فن کویل'],
    CABINET: ['هایگلاس', 'MDF', 'فلزی', 'فلزی هایگلاس', 'فلزی MDF'],
    FLOORING: ['سرامیک', 'موکت', 'پارکت', 'سنگ', 'کفپوش'],
    CLOSET: ['بدون کمد دیواری', '۱ خواب', '۲ خواب', '۳ خواب', 'تمام اتاق‌ها'],
    OTHERS: [
      'کناف کاری',
      'تی وی روم',
      'شیرآلات',
      'آکاردئونی',
      'درب ضد سرقت',
      'پارکینگ',
      'انباری',
      'آسانسور',
      'لابی مجهز',
      'سیستم امنیتی',
      'دوربین مداربسته'
    ]
  },

  // Customer types
  CUSTOMER_TYPES: {
    LOCAL: 'yes',
    NON_LOCAL: 'no'
  },

  // Previous deal status
  DEAL_STATUS: {
    REJECTED: 'rejected',
    SUCCESSFUL: 'successful'
  },

  // Default customer budget
  DEFAULT_BUDGET: 800,

  // Pagination defaults
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100
  },

  // JWT configuration
  JWT: {
    EXPIRES_IN: '7d', // Token expiration
    ALGORITHM: 'HS256'
  },

  // Validation regex patterns
  REGEX: {
    PHONE: /^09\d{9}$/, // Iranian mobile numbers
    NATIONAL_ID: /^\d{10}$/, // 10-digit national ID
    PERSIAN_TEXT: /^[\u0600-\u06FF\s]+$/, // Persian/Arabic characters
    ALPHANUMERIC: /^[a-zA-Z0-9_\u0600-\u06FF\s]+$/, // Alphanumeric + Persian
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    URL: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
    DATE: /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    PRICE: /^\d+(,\d{3})*(\.\d{1,2})?$/ // Price format
  },

  // Error messages
  ERRORS: {
    // Authentication errors
    AUTH: {
      NO_TOKEN: 'Access denied. No token provided.',
      INVALID_TOKEN: 'Invalid or expired token.',
      NOT_APPROVED: 'Account pending approval. Please wait for admin approval.',
      INVALID_CREDENTIALS: 'Invalid credentials.',
      ACCESS_DENIED: 'Access denied.',
      ADMIN_ONLY: 'Admin access required.'
    },

    // Validation errors
    VALIDATION: {
      REQUIRED: (field) => `${field} is required.`,
      MIN_LENGTH: (field, length) => `${field} must be at least ${length} characters.`,
      MAX_LENGTH: (field, length) => `${field} must not exceed ${length} characters.`,
      INVALID_FORMAT: (field) => `Invalid ${field} format.`,
      INVALID_TYPE: (field, type) => `${field} must be ${type}.`,
      DUPLICATE: (field) => `${field} already exists.`
    },

    // File upload errors
    UPLOAD: {
      NO_FILE: 'No file uploaded.',
      INVALID_TYPE: 'Invalid file type.',
      TOO_LARGE: (maxSize) => `File size exceeds ${maxSize} limit.`,
      UPLOAD_FAILED: 'File upload failed.'
    },

    // Database errors
    DATABASE: {
      CONNECTION: 'Database connection failed.',
      QUERY: 'Database query failed.',
      NOT_FOUND: (resource) => `${resource} not found.`,
      DUPLICATE_ENTRY: 'Duplicate entry found.'
    }
  },

  // Success messages
  SUCCESS: {
    CREATED: (resource) => `${resource} created successfully.`,
    UPDATED: (resource) => `${resource} updated successfully.`,
    DELETED: (resource) => `${resource} deleted successfully.`,
    UPLOADED: (resource) => `${resource} uploaded successfully.`
  },

  // API response codes
  STATUS_CODES: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    SERVER_ERROR: 500
  },

  // Date formats
  DATE_FORMATS: {
    DATABASE: 'YYYY-MM-DD HH:mm:ss',
    DISPLAY: 'YYYY/MM/DD',
    PERSIAN: 'jYYYY/jMM/jDD'
  },

  // File storage paths
  PATHS: {
    UPLOADS: 'uploads',
    ID_PHOTOS: 'uploads/id-photos',
    MAPS: 'uploads/maps',
    TEMP: 'uploads/temp'
  },

  // Environment modes
  ENV: {
    DEVELOPMENT: 'development',
    PRODUCTION: 'production',
    TEST: 'test'
  },

  // Cache TTL (Time To Live) in seconds
  CACHE_TTL: {
    SHORT: 300, // 5 minutes
    MEDIUM: 3600, // 1 hour
    LONG: 86400 // 24 hours
  },

  // Rate limiting
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100 // limit each IP to 100 requests per windowMs
  }
};