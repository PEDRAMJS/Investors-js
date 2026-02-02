const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const userService = require('./userService');

class AuthService {
  // Generate JWT token
  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        name: user.name,
        approved: user.approved,
        is_admin: user.is_admin || false
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  // Login user
  async login(username, password) {
    const user = await userService.findUser('name', username);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    // Check approval (optional - you can remove if auto-approving)
    // if (!user.approved) {
    //   throw new Error('Account pending approval');
    // }

    const token = this.generateToken(user);
    
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        phone_number: user.phone_number,
        is_admin: user.is_admin,
        approved: user.approved
      }
    };
  }

  // Register user
  async register(userData) {
    // Check if user exists
    const existingUser = await userService.findUser('name', userData.name);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Check phone number
    const existingPhone = await userService.findUser('phone_number', userData.phone_number);
    if (existingPhone) {
      throw new Error('Phone number already registered');
    }

    // Check national ID
    if (userData.national_id) {
      const existingNationalId = await userService.findUser('national_id', userData.national_id);
      if (existingNationalId) {
        throw new Error('National ID already registered');
      }
    }

    // Create user
    const userId = await userService.createUser(userData);
    
    // Get created user
    const user = await userService.getUserById(userId);
    const token = this.generateToken(user);

    return {
      token,
      user
    };
  }
}

module.exports = new AuthService();