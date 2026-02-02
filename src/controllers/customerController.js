const customerService = require('../services/customerService');
const { validationResult } = require('express-validator');
const constants = require('../config/constants');

class CustomerController {
  /**
   * Create a new customer
   * POST /api/customers
   */
  async createCustomer(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const result = await customerService.createCustomer(req.body, req.user.id);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: result.customer
      });
    } catch (error) {
      console.error('Create customer error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create customer',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get all customers for the authenticated user
   * GET /api/customers
   */
  async getCustomers(req, res) {
    try {
      const filters = {
        previous_deal: req.query.deal_status,
        is_local: req.query.is_local,
        estate_type: req.query.estate_type,
        search: req.query.search,
        min_budget: req.query.min_budget,
        max_budget: req.query.max_budget,
        limit: req.query.limit || 50,
        offset: req.query.offset || 0
      };

      // Remove undefined filters
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const result = await customerService.getUserCustomers(req.user.id, filters);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        data: result.customers,
        meta: {
          count: result.count,
          filters: filters
        }
      });
    } catch (error) {
      console.error('Get customers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch customers',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get a single customer by ID
   * GET /api/customers/:id
   */
  async getCustomer(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'Valid customer ID is required'
        });
      }

      const result = await customerService.getCustomerById(id, req.user.id);
      
      if (!result.success) {
        const statusCode = result.error.includes('not found') ? 404 : 
                          result.error.includes('Access denied') ? 403 : 400;
        return res.status(statusCode).json(result);
      }

      res.json({
        success: true,
        data: result.customer
      });
    } catch (error) {
      console.error('Get customer error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch customer',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Update a customer
   * PUT /api/customers/:id
   */
  async updateCustomer(req, res) {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'Valid customer ID is required'
        });
      }

      const result = await customerService.updateCustomer(id, req.body, req.user.id);
      
      if (!result.success) {
        const statusCode = result.error.includes('not found') ? 404 : 
                          result.error.includes('Access denied') ? 403 : 400;
        return res.status(statusCode).json(result);
      }

      res.json({
        success: true,
        message: 'Customer updated successfully',
        data: result.customer
      });
    } catch (error) {
      console.error('Update customer error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update customer',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Delete a customer
   * DELETE /api/customers/:id
   */
  async deleteCustomer(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'Valid customer ID is required'
        });
      }

      const result = await customerService.deleteCustomer(id, req.user.id);
      
      if (!result.success) {
        const statusCode = result.error.includes('not found') ? 404 : 
                          result.error.includes('Access denied') ? 403 : 400;
        return res.status(statusCode).json(result);
      }

      res.json({
        success: true,
        message: 'Customer deleted successfully'
      });
    } catch (error) {
      console.error('Delete customer error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete customer',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get customer statistics
   * GET /api/customers/stats
   */
  async getCustomerStats(req, res) {
    try {
      const result = await customerService.getCustomerStatistics(req.user.id);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        data: result.statistics
      });
    } catch (error) {
      console.error('Get customer stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch customer statistics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Search customers
   * GET /api/customers/search
   */
  async searchCustomers(req, res) {
    try {
      const { q: searchTerm } = req.query;
      
      if (!searchTerm || searchTerm.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Search term must be at least 2 characters'
        });
      }

      const result = await customerService.searchCustomers(
        searchTerm, 
        req.user.id, 
        req.user.is_admin
      );
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        data: result.customers,
        meta: {
          count: result.count,
          search_term: searchTerm
        }
      });
    } catch (error) {
      console.error('Search customers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search customers',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Mark customer deal as successful
   * PATCH /api/customers/:id/mark-successful
   */
  async markDealSuccessful(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'Valid customer ID is required'
        });
      }

      const result = await customerService.markDealSuccessful(id, req.user.id);
      
      if (!result.success) {
        const statusCode = result.error.includes('not found') ? 404 : 
                          result.error.includes('Access denied') ? 403 : 400;
        return res.status(statusCode).json(result);
      }

      res.json({
        success: true,
        message: 'Deal marked as successful',
        data: result.customer
      });
    } catch (error) {
      console.error('Mark deal successful error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update deal status',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Mark customer deal as rejected
   * PATCH /api/customers/:id/mark-rejected
   */
  async markDealRejected(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'Valid customer ID is required'
        });
      }

      const result = await customerService.markDealRejected(id, req.user.id);
      
      if (!result.success) {
        const statusCode = result.error.includes('not found') ? 404 : 
                          result.error.includes('Access denied') ? 403 : 400;
        return res.status(statusCode).json(result);
      }

      res.json({
        success: true,
        message: 'Deal marked as rejected',
        data: result.customer
      });
    } catch (error) {
      console.error('Mark deal rejected error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update deal status',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Export customers to CSV
   * GET /api/customers/export
   */
  async exportCustomers(req, res) {
    try {
      const result = await customerService.exportCustomersToCSV(
        req.user.id, 
        req.user.is_admin
      );
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      
      res.send(result.csv);
    } catch (error) {
      console.error('Export customers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export customers',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get all customers (admin only)
   * GET /api/admin/customers
   */
  async getAllCustomers(req, res) {
    try {
      if (!req.user.is_admin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const filters = {
        user_id: req.query.user_id,
        previous_deal: req.query.deal_status,
        search: req.query.search,
        limit: req.query.limit || 50,
        offset: req.query.offset || 0
      };

      // Remove undefined filters
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const result = await customerService.getAllCustomers(filters);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        data: result.customers,
        meta: {
          count: result.count,
          filters: filters
        }
      });
    } catch (error) {
      console.error('Get all customers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch customers',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

// Create singleton instance
module.exports = new CustomerController();