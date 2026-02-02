const validateRegistration = (data) => {
  const errors = [];

  if (!data.name || data.name.length < 3) {
    errors.push('Name must be at least 3 characters');
  }

  if (!data.phone_number || !/^09\d{9}$/.test(data.phone_number)) {
    errors.push('Phone number must be 11 digits starting with 09');
  }

  if (!data.password || data.password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (data.national_id && !/^\d{10}$/.test(data.national_id)) {
    errors.push('National ID must be 10 digits');
  }

  return errors;
};

const validateLogin = (data) => {
  const errors = [];

  if (!data.name) {
    errors.push('Username is required');
  }

  if (!data.password) {
    errors.push('Password is required');
  }

  return errors;
};

module.exports = {
  validateRegistration,
  validateLogin
};