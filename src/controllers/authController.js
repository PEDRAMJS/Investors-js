const authService = require('../services/authService');
const { validateRegistration, validateLogin } = require('../utils/validators');

class AuthController {
  async register(req, res) {
    try {
      // Validate input
      const errors = validateRegistration(req.body);
      if (errors.length > 0) {
        return res.status(400).json({ errors });
      }

      const result = await authService.register(req.body);
      
      res.status(201).json({
        message: 'User registered successfully',
        ...result
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async login(req, res) {
    try {
      // Validate input
      const errors = validateLogin(req.body);
      if (errors.length > 0) {
        return res.status(400).json({ errors });
      }

      const { name, password } = req.body;
      const result = await authService.login(name, password);
      
      res.json({
        message: 'Login successful',
        ...result
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getProfile(req, res) {
    try {
      const user = await authService.getUserById(req.user.id);
      res.json({ user });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Both passwords are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }

      // Implement password change logic here
      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
}

module.exports = new AuthController();