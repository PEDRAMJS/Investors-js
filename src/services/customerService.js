const Customer = require('../models/Customer');
const User = require('../models/User');

class CustomerService {
  /**
   * Create a new customer
   */
  async createCustomer(customerData, userId) {
    try {
      // Get user info for creator_name
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create customer instance
      const customer = new Customer({
        ...customerData,
        user_id: userId,
        creator_name: user.name
      });

      // Validate and save
      await customer.save();
      
      return {
        success: true,
        customer: customer.toJSON(),
        message: 'Customer created successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update customer
   */
  async updateCustomer(customerId, customerData, userId) {
    try {
      // Get existing customer
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Check ownership (unless admin)
      const user = await User.findById(userId);
      if (!user.is_admin && customer.user_id !== userId) {
        throw new Error('Access denied');
      }

      // Update customer data
      Object.assign(customer, customerData);
      await customer.save();
      
      return {
        success: true,
        customer: customer.toJSON(),
        message: 'Customer updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete customer
   */
  async deleteCustomer(customerId, userId) {
    try {
      // Get existing customer
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Check ownership (unless admin)
      const user = await User.findById(userId);
      if (!user.is_admin && customer.user_id !== userId) {
        throw new Error('Access denied');
      }

      await customer.delete();
      
      return {
        success: true,
        message: 'Customer deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId, userId) {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Check ownership (unless admin)
      const user = await User.findById(userId);
      if (!user.is_admin && customer.user_id !== userId) {
        throw new Error('Access denied');
      }

      return {
        success: true,
        customer: customer.toJSON()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all customers for a user
   */
  async getUserCustomers(userId, filters = {}) {
    try {
      const customers = await Customer.findByUserId(userId, filters);
      
      return {
        success: true,
        customers: customers.map(c => c.toJSON()),
        count: customers.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all customers (admin only)
   */
  async getAllCustomers(filters = {}) {
    try {
      const customers = await Customer.findAll(filters);
      
      return {
        success: true,
        customers: customers.map(c => c.toJSON()),
        count: customers.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get customer statistics
   */
  async getCustomerStatistics(userId = null) {
    try {
      const stats = await Customer.getStatistics(userId);
      
      return {
        success: true,
        statistics: stats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search customers
   */
  async searchCustomers(searchTerm, userId = null, isAdmin = false) {
    try {
      let customers;
      
      if (isAdmin) {
        // Admin can search all customers
        customers = await Customer.findAll({ search: searchTerm });
      } else {
        // Regular user can only search their own customers
        customers = await Customer.findByUserId(userId, { search: searchTerm });
      }
      
      return {
        success: true,
        customers: customers.map(c => c.toJSON()),
        count: customers.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mark customer deal as successful
   */
  async markDealSuccessful(customerId, userId) {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Check ownership (unless admin)
      const user = await User.findById(userId);
      if (!user.is_admin && customer.user_id !== userId) {
        throw new Error('Access denied');
      }

      await customer.markSuccessful();
      
      return {
        success: true,
        customer: customer.toJSON(),
        message: 'Deal marked as successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mark customer deal as rejected
   */
  async markDealRejected(customerId, userId) {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Check ownership (unless admin)
      const user = await User.findById(userId);
      if (!user.is_admin && customer.user_id !== userId) {
        throw new Error('Access denied');
      }

      await customer.markRejected();
      
      return {
        success: true,
        customer: customer.toJSON(),
        message: 'Deal marked as rejected'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Export customers to CSV (basic implementation)
   */
  async exportCustomersToCSV(userId, isAdmin = false) {
    try {
      let customers;
      
      if (isAdmin) {
        customers = await Customer.findAll();
      } else {
        customers = await Customer.findByUserId(userId);
      }

      // Convert to CSV format
      const headers = ['ID', 'Name', 'Budget', 'Contact', 'Local', 'Demands', 'Deal Status', 'Estate Type', 'Created At'];
      const rows = customers.map(customer => [
        customer.id,
        customer.name,
        customer.budget,
        customer.contact,
        customer.is_local,
        customer.demands,
        customer.previous_deal,
        customer.estate_type,
        customer.created_at
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      return {
        success: true,
        csv: csvContent,
        filename: `customers_${new Date().toISOString().split('T')[0]}.csv`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
module.exports = new CustomerService();