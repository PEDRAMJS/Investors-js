const path = require('path');
const fs = require('fs');

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const validatePhoneNumber = (phone) => {
  const phoneRegex = /^09\d{9}$/;
  return phoneRegex.test(phone);
};

const validateNationalId = (nationalId) => {
  const nationalIdRegex = /^\d{10}$/;
  return nationalIdRegex.test(nationalId);
};

const deleteFile = (filePath) => {
  if (filePath) {
    const fullPath = path.join(__dirname, '../..', filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
};

const getFileTypeLabel = (mimeType) => {
  if (!mimeType) return 'فایل';

  if (mimeType.startsWith('image/')) {
    return 'تصویر';
  } else if (mimeType === 'application/pdf') {
    return 'PDF';
  } else if (mimeType.includes('zip') || mimeType.includes('rar')) {
    return 'آرشیو';
  }

  return 'سند';
};

function generateRandomString(length = 10, options = {}) {
  const {
    includeNumbers = true,
    includeLowercase = true,
    includeUppercase = true,
    includeSpecial = false,
    customChars = ''
  } = options;

  // Define character sets
  const numbers = '0123456789';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  // Build character pool based on options
  let charPool = customChars || '';

  if (includeNumbers) charPool += numbers;
  if (includeLowercase) charPool += lowercase;
  if (includeUppercase) charPool += uppercase;
  if (includeSpecial) charPool += special;

  // Validate character pool
  if (!charPool) {
    throw new Error('No character sets selected. Please enable at least one character set.');
  }

  if (length <= 0) {
    throw new Error('Length must be greater than 0');
  }

  // Generate random string
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charPool.length);
    result += charPool[randomIndex];
  }

  return result;
}

module.exports = {
  formatFileSize,
  validatePhoneNumber,
  validateNationalId,
  deleteFile,
  getFileTypeLabel,
  generateRandomString
};