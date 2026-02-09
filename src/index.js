const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const multer = require('multer'); // Add this
const path = require('path');
const fs = require('fs');
const { error } = require('console');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://94.182.92.245', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

const verifyTokenAndApproval = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.', revoke_auth: true });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

const checkIsAdmin = (user_id, callback) => {
  const checkAdminQuery = 'SELECT is_admin FROM users WHERE id = ?';
  db.query(checkAdminQuery, [user_id], (err, results) => {
    if (err) {
      return callback(err, null);
    }

    if (results.length === 0) {
      return callback(null, false);
    }

    const isAdmin = results[0]?.is_admin === 1 || results[0]?.is_admin === true;
    return callback(null, isAdmin);
  });
}

// // MySQL Database Connection
// const db = mysql.createConnection({
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   // waitForConnections: true,
//   // connectionLimit: 10,
//   // queueLimit: 0
// });

// // Connect to MySQL
// db.connect((err) => {
//   if (err) {
//     console.error('Error connecting to MySQL:', err);
//     process.exit(1);
//   }
//   console.log('Connected to MySQL database');

//   // Initialize database tables
//   //   initializeDatabase();
// });

// MySQL Database Connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  pool: true
  // connectionLimit: 10,
  // queueLimit: 0
});


// Connect to MySQL
// db.getConnection((err) => {
//   if (err) {
//     console.error('Error connecting to MySQL:', err);
//     process.exit(1);
//   }
//   console.log('Connected to MySQL database');

//   // Initialize database tables
//   //   initializeDatabase();
// });


// ========== FILE UPLOAD CONFIGURATION ==========
// Configure file upload storage
const idPhotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/id-photos');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-random-originalname
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const ext = path.extname(file.originalname);
    const filename = `id_${timestamp}_${random}${ext}`;
    cb(null, filename);
  }
});

// File filter for images only
const idPhotoFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|bmp|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    // Check file size (max 2MB)
    if (file.size > 20 * 1024 * 1024) {
      cb(new Error('File size exceeds 20MB limit'), false);
    } else {
      cb(null, true);
    }
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Create upload middleware instance
const upload = multer({
  storage: idPhotoStorage,
  fileFilter: idPhotoFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 2MB limit
});

// ========== END FILE UPLOAD CONFIG ==========

// ========== MAPS ROUTES ==========

// Configure storage for maps
const mapsStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/maps');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-random-originalname
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const ext = path.extname(file.originalname);
    const originalName = path.basename(file.originalname, ext);
    const safeName = originalName.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
    const filename = `map_${timestamp}_${random}_${safeName}${ext}`;
    cb(null, filename);
  }
});

// File filter for maps (images, PDF, zip, rar)
const mapsFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|pdf|zip|rar/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      cb(new Error('File size exceeds 5MB limit'), false);
    } else {
      cb(null, true);
    }
  } else {
    cb(new Error('Only image, PDF, and archive files are allowed'), false);
  }
};

// Create upload middleware for maps
const uploadMap = multer({
  storage: mapsStorage,
  fileFilter: mapsFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// Generate unique contract number
const generateContractNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `CON-${timestamp}-${random}`;
};

// Configure storage for contracts
const contractsStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/contracts');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-random-originalname
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const ext = path.extname(file.originalname);
    const originalName = path.basename(file.originalname, ext);
    const safeName = originalName.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
    const filename = `contract_${timestamp}_${random}_${safeName}${ext}`;
    cb(null, filename);
  }
});

// File filter for contracts (images, PDF, zip, rar)
const contractsFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|pdf|zip|rar/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    // Check file size (max 5MB)
    if (file.size > 10 * 1024 * 1024) {
      cb(new Error('File size exceeds 10MB limit'), false);
    } else {
      cb(null, true);
    }
  } else {
    cb(new Error('Only image, PDF, and archive files are allowed'), false);
  }
};

// Create upload middleware for contracts
const uploadContract = multer({
  storage: contractsStorage,
  fileFilter: contractsFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

const invoicesStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/invoices');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-random-originalname
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const ext = path.extname(file.originalname);
    const originalName = path.basename(file.originalname, ext);
    const safeName = originalName.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
    const filename = `contract_${timestamp}_${random}_${safeName}${ext}`;
    cb(null, filename);
  }
});

// File filter for contracts (images, PDF, zip, rar)
const invoicesFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|pdf|zip|rar/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    // Check file size (max 5MB)
    if (file.size > 10 * 1024 * 1024) {
      cb(new Error('File size exceeds 10MB limit'), false);
    } else {
      cb(null, true);
    }
  } else {
    cb(new Error('Only image, PDF, and archive files are allowed'), false);
  }
};

// Create upload middleware for contracts
const uploadinvoice = multer({
  storage: invoicesStorage,
  fileFilter: invoicesFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

app.post('/api/invoices', verifyTokenAndApproval, uploadinvoice.single('invoice_photo'), async (req, res) => {
  try {
    const { description, amount, units } = req.body;
    const issued_by = req.user.id; // Assuming user ID comes from authentication middleware

    // Required fields validation
    if (!description || !amount || !units) {
      if (req.file) {
        // Clean up uploaded file if validation fails
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        error: 'Please provide description, amount, and units'
      });
    }

    // Amount validation
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        error: 'Amount must be a positive number'
      });
    }

    // Units validation
    const validUnits = ['دلار', 'ریال', 'تومان'];
    if (!validUnits.includes(units)) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        error: 'Invalid unit. Must be one of: دلار, ریال, تومان'
      });
    }

    // Invoice photo validation
    if (!req.file) {
      return res.status(400).json({
        error: 'Invoice photo is required'
      });
    }

    // Check if user exists
    const checkUserQuery = 'SELECT id FROM users WHERE id = ?';
    db.query(checkUserQuery, [issued_by], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({ error: 'User not found' });
      }

      // Prepare file path for database
      const invoicePhotoPath = `/uploads/invoices/${req.file.filename}`;

      // Create invoice
      const insertInvoiceQuery = `
        INSERT INTO invoices (
          uuid, description, issued_by, amount, units, invoice_photo_path
        ) VALUES (UUID(), ?, ?, ?, ?, ?)
      `;

      db.query(
        insertInvoiceQuery,
        [
          description,
          issued_by,
          amountNum,
          units,
          invoicePhotoPath
        ],
        (err, result) => {
          if (err) {
            console.error('Error creating invoice:', err);

            // Clean up uploaded file if DB insert fails
            if (req.file) {
              fs.unlinkSync(req.file.path);
            }

            return res.status(500).json({
              error: 'Error creating invoice',
              details: err.message
            });
          }

          // Fetch the created invoice with UUID
          const getInvoiceQuery = 'SELECT * FROM invoices WHERE id = ?';
          db.query(getInvoiceQuery, [result.insertId], (err, invoiceResults) => {
            if (err) {
              console.error('Error fetching created invoice:', err);
              // Still return success since invoice was created
              return res.status(201).json({
                message: 'Invoice created successfully',
                invoice_id: result.insertId
              });
            }

            res.status(201).json({
              message: 'Invoice created successfully',
              invoice: invoiceResults[0]
            });
          });
        }
      );
    });
  } catch (error) {
    console.error('Invoice creation error:', error);

    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Server error during invoice creation',
      details: error.message
    });
  }
});

app.get('/api/invoices', verifyTokenAndApproval, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const userId = req.query.user_id; // Optional filter by user

    let query = `
      SELECT 
        inv.*,
        usr.name as issued_by_name,
        usr.phone_number as issued_by_phone
      FROM invoices inv
      LEFT JOIN users usr ON inv.issued_by = usr.id
    `;

    let countQuery = 'SELECT COUNT(*) as total FROM invoices';
    const queryParams = [];
    const countParams = [];

    if (userId) {
      query += ' WHERE inv.issued_by = ?';
      countQuery += ' WHERE issued_by = ?';
      queryParams.push(userId);
      countParams.push(userId);
    }

    query += ' ORDER BY inv.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    // Get total count
    db.query(countQuery, countParams, (err, countResults) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      const total = countResults[0].total;
      const totalPages = Math.ceil(total / limit);

      // Get invoices
      db.query(query, queryParams, (err, results) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        res.json({
          invoices: results,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        });
      });
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      error: 'Server error fetching invoices',
      details: error.message
    });
  }
});

app.get('/api/invoices/:uuid', verifyTokenAndApproval, async (req, res) => {
  try {
    const { uuid } = req.params;

    const query = `
      SELECT 
        inv.*,
        usr.name as issued_by_name,
        usr.phone_number as issued_by_phone
      FROM invoices inv
      LEFT JOIN users usr ON inv.issued_by = usr.id
      WHERE inv.uuid = ?
    `;

    db.query(query, [uuid], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      res.json({
        invoice: results[0]
      });
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      error: 'Server error fetching invoice',
      details: error.message
    });
  }
});

app.put('/api/invoices/:uuid', verifyTokenAndApproval, uploadinvoice.single('invoice_photo'), async (req, res) => {
  try {
    const { uuid } = req.params;
    const { description, amount, units } = req.body;
    const userId = req.user.id; // For authorization check

    // Find existing invoice
    const findInvoiceQuery = 'SELECT * FROM invoices WHERE uuid = ?';
    db.query(findInvoiceQuery, [uuid], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const existingInvoice = results[0];

      // Authorization check - only creator or admin can update
      if (existingInvoice.issued_by !== userId && req.user.role !== 'admin') {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({ error: 'Not authorized to update this invoice' });
      }

      // Prepare update data
      const updateData = {
        description: description || existingInvoice.description,
        amount: amount ? parseFloat(amount) : existingInvoice.amount,
        units: units || existingInvoice.units,
        updated_at: new Date()
      };

      // Validate amount if provided
      if (amount) {
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
          if (req.file) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(400).json({
            error: 'Amount must be a positive number'
          });
        }
      }

      // Validate units if provided
      if (units) {
        const validUnits = ['دلار', 'ریال', 'تومان'];
        if (!validUnits.includes(units)) {
          if (req.file) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(400).json({
            error: 'Invalid unit. Must be one of: دلار, ریال, تومان'
          });
        }
      }

      // Handle new photo if provided
      let oldPhotoPath = null;
      if (req.file) {
        oldPhotoPath = existingInvoice.invoice_photo_path;
        updateData.invoice_photo_path = `/uploads/invoices/${req.file.filename}`;
      }

      // Update invoice
      const updateQuery = `
        UPDATE invoices 
        SET description = ?, amount = ?, units = ?, invoice_photo_path = ?, updated_at = ?
        WHERE uuid = ?
      `;

      db.query(
        updateQuery,
        [
          updateData.description,
          updateData.amount,
          updateData.units,
          updateData.invoice_photo_path || existingInvoice.invoice_photo_path,
          updateData.updated_at,
          uuid
        ],
        (err, result) => {
          if (err) {
            console.error('Error updating invoice:', err);
            if (req.file) {
              fs.unlinkSync(req.file.path);
            }
            return res.status(500).json({
              error: 'Error updating invoice',
              details: err.message
            });
          }

          // Delete old photo if it was replaced
          if (oldPhotoPath && req.file) {
            const oldPhotoFullPath = path.join(__dirname, '..', oldPhotoPath);
            if (fs.existsSync(oldPhotoFullPath)) {
              fs.unlinkSync(oldPhotoFullPath);
            }
          }

          // Fetch updated invoice
          db.query(findInvoiceQuery, [uuid], (err, updatedResults) => {
            if (err) {
              console.error('Error fetching updated invoice:', err);
              // Still return success
              return res.json({
                message: 'Invoice updated successfully',
                updated: result.affectedRows > 0
              });
            }

            res.json({
              message: 'Invoice updated successfully',
              invoice: updatedResults[0]
            });
          });
        }
      );
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: 'Server error updating invoice',
      details: error.message
    });
  }
});

app.delete('/api/invoices/:uuid', verifyTokenAndApproval, async (req, res) => {
  try {
    const { uuid } = req.params;
    const userId = req.user.id; // For authorization check

    // Find invoice to get photo path and check ownership
    const findInvoiceQuery = 'SELECT * FROM invoices WHERE uuid = ?';
    db.query(findInvoiceQuery, [uuid], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const invoice = results[0];

      // Authorization check - only creator or admin can delete
      if (invoice.issued_by !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized to delete this invoice' });
      }

      // Get photo path before deletion
      const invoicePhotoPath = invoice.invoice_photo_path;

      // Delete invoice
      const deleteQuery = 'DELETE FROM invoices WHERE uuid = ?';
      db.query(deleteQuery, [uuid], (err, result) => {
        if (err) {
          console.error('Error deleting invoice:', err);
          return res.status(500).json({
            error: 'Error deleting invoice',
            details: err.message
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Invoice not found' });
        }

        // Delete associated photo file
        if (invoicePhotoPath) {
          const fullPath = path.join(__dirname, '..', invoicePhotoPath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }

        res.json({
          message: 'Invoice deleted successfully',
          deleted: true
        });
      });
    });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({
      error: 'Server error deleting invoice',
      details: error.message
    });
  }
});

app.get('/api/invoice/stats', verifyTokenAndApproval, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let query = `
            SELECT 
                COUNT(*) as total_invoices,
                COALESCE(SUM(amount), 0) as total_amount,
                COALESCE(AVG(amount), 0) as average_amount,
                units as top_unit
            FROM invoices
        `;

    if (!isAdmin) {
      query += ' WHERE issued_by = ?';
    }

    query += ' GROUP BY units ORDER BY COUNT(*) DESC LIMIT 1';

    db.query(query, [!isAdmin ? userId : null].filter(Boolean), (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      const stats = {
        total_invoices: 0,
        total_amount: 0,
        average_amount: 0,
        top_unit: null
      };

      if (results.length > 0) {
        // Get top unit
        stats.top_unit = results[0].top_unit;

        // Get total stats
        const totalQuery = `
                    SELECT 
                        COUNT(*) as total_invoices,
                        COALESCE(SUM(amount), 0) as total_amount,
                        COALESCE(AVG(amount), 0) as average_amount
                    FROM invoices
                    ${!isAdmin ? 'WHERE issued_by = ?' : ''}
                `;

        db.query(totalQuery, [!isAdmin ? userId : null].filter(Boolean), (err, totalResults) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          if (totalResults.length > 0) {
            stats.total_invoices = totalResults[0].total_invoices;
            stats.total_amount = totalResults[0].total_amount;
            stats.average_amount = totalResults[0].average_amount;
          }

          res.json(stats);
        });
      } else {
        res.json(stats);
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      error: 'Server error fetching stats',
      details: error.message
    });
  }
});

// Get all maps (public, but requires authentication)
app.get('/api/maps', verifyTokenAndApproval, (req, res) => {
  const getMapsQuery = `
    SELECT 
      m.*,
      u.name as uploaded_by_name,
      u.phone_number as uploaded_by_phone
    FROM maps m
    LEFT JOIN users u ON m.uploaded_by = u.id
    ORDER BY m.created_at DESC
  `;

  db.query(getMapsQuery, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch maps' });
    }
    res.json(results);
  });
});

// Get single map by ID
app.get('/api/maps/:id', verifyTokenAndApproval, (req, res) => {
  const getMapQuery = `
    SELECT 
      m.*,
      u.name as uploaded_by_name,
      u.phone_number as uploaded_by_phone
    FROM maps m
    LEFT JOIN users u ON m.uploaded_by = u.id
    WHERE m.id = ?
  `;

  db.query(getMapQuery, [req.params.id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch map' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Map not found' });
    }

    res.json(results[0]);
  });
});

// Upload map (Admin only)
app.post('/api/maps/upload', verifyTokenAndApproval, uploadMap.single('file'), async (req, res) => {
  try {
    // Check if user is admin
    const checkAdminQuery = 'SELECT is_admin FROM users WHERE id = ?';
    db.query(checkAdminQuery, [req.user.id], (err, results) => {
      if (err || !results[0]?.is_admin) {
        // Clean up uploaded file if not admin
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({ error: 'Admin access required for upload' });
      }

      const { title, description, uploaded_by } = req.body;

      // Validate required fields
      if (!title || !title.trim()) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ error: 'Title is required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'File is required' });
      }

      // Get user info for uploaded_by_name
      const getUserQuery = 'SELECT name FROM users WHERE id = ?';
      db.query(getUserQuery, [uploaded_by || req.user.id], (err, userResults) => {
        if (err) {
          console.error('Database error:', err);
          if (req.file) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(500).json({ error: 'Database error' });
        }

        const uploadedByName = userResults.length > 0 ? userResults[0].name : 'Admin';

        // Prepare file path for database
        const filePath = `/uploads/maps/${req.file.filename}`;

        // Determine file type
        let fileType = req.file.mimetype;

        // Insert map into database
        const insertMapQuery = `
          INSERT INTO maps (
            title, description, file_path, file_type, file_size,
            uploaded_by, uploaded_by_name
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
          insertMapQuery,
          [
            title.trim(),
            description ? description.trim() : null,
            filePath,
            fileType,
            req.file.size,
            uploaded_by || req.user.id,
            uploadedByName
          ],
          (err, result) => {
            if (err) {
              console.error('Database error:', err);
              // Clean up uploaded file on DB error
              if (req.file) {
                fs.unlinkSync(req.file.path);
              }
              return res.status(500).json({ error: 'Failed to save map to database' });
            }

            // Get the created map with user info
            const getMapQuery = `
              SELECT 
                m.*,
                u.name as uploaded_by_name,
                u.phone_number as uploaded_by_phone
              FROM maps m
              LEFT JOIN users u ON m.uploaded_by = u.id
              WHERE m.id = ?
            `;

            db.query(getMapQuery, [result.insertId], (err, mapResults) => {
              if (err) {
                console.error('Database error:', err);
                // Map is saved, but we can't return full data
                return res.status(201).json({
                  id: result.insertId,
                  title: title.trim(),
                  file_path: filePath,
                  message: 'Map uploaded successfully'
                });
              }

              res.status(201).json(mapResults[0]);
            });
          }
        );
      });
    });
  } catch (error) {
    console.error('Upload error:', error);
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: 'Server error during upload',
      details: error.message
    });
  }
});

// Update map (Admin only - only title and description)
app.put('/api/maps/:id', verifyTokenAndApproval, (req, res) => {
  // Check if user is admin
  const checkAdminQuery = 'SELECT is_admin FROM users WHERE id = ?';
  db.query(checkAdminQuery, [req.user.id], (err, results) => {
    if (err || !results[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { title, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // First check if map exists
    const checkMapQuery = 'SELECT * FROM maps WHERE id = ?';
    db.query(checkMapQuery, [req.params.id], (err, mapResults) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (mapResults.length === 0) {
        return res.status(404).json({ error: 'Map not found' });
      }

      // Update map (only title and description)
      const updateMapQuery = `
        UPDATE maps 
        SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      db.query(
        updateMapQuery,
        [
          title.trim(),
          description ? description.trim() : null,
          req.params.id
        ],
        (err) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to update map' });
          }

          // Get updated map
          const getUpdatedQuery = `
            SELECT 
              m.*,
              u.name as uploaded_by_name,
              u.phone_number as uploaded_by_phone
            FROM maps m
            LEFT JOIN users u ON m.uploaded_by = u.id
            WHERE m.id = ?
          `;

          db.query(getUpdatedQuery, [req.params.id], (err, updatedResults) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to fetch updated map' });
            }

            res.json(updatedResults[0]);
          });
        }
      );
    });
  });
});

// Delete map (Admin only)
app.delete('/api/maps/:id', verifyTokenAndApproval, (req, res) => {
  // Check if user is admin
  const checkAdminQuery = 'SELECT is_admin FROM users WHERE id = ?';
  db.query(checkAdminQuery, [req.user.id], (err, results) => {
    if (err || !results[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // First get map to delete its file
    const getMapQuery = 'SELECT file_path FROM maps WHERE id = ?';
    db.query(getMapQuery, [req.params.id], (err, mapResults) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (mapResults.length === 0) {
        return res.status(404).json({ error: 'Map not found' });
      }

      const filePath = mapResults[0].file_path;

      // Delete map from database
      const deleteMapQuery = 'DELETE FROM maps WHERE id = ?';
      db.query(deleteMapQuery, [req.params.id], (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to delete map' });
        }

        // Delete the file
        if (filePath) {
          const fullPath = path.join(__dirname, '..', filePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }

        res.json({ message: 'Map deleted successfully' });
      });
    });
  });
});

// Get maps statistics
app.get('/api/maps/stats', verifyTokenAndApproval, (req, res) => {
  const statsQuery = `
    SELECT 
      COUNT(*) as total_maps,
      COALESCE(SUM(file_size), 0) as total_size,
      COALESCE(AVG(file_size), 0) as average_size,
      COUNT(CASE WHEN MONTH(created_at) = MONTH(CURRENT_DATE()) 
                AND YEAR(created_at) = YEAR(CURRENT_DATE()) 
                THEN 1 END) as this_month,
      MAX(created_at) as last_upload_date,
      (
        SELECT uploaded_by_name 
        FROM maps 
        ORDER BY created_at DESC 
        LIMIT 1
      ) as last_uploader
    FROM maps
  `;

  db.query(statsQuery, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch map statistics' });
    }

    res.json(results[0] || {
      total_maps: 0,
      total_size: 0,
      average_size: 0,
      this_month: 0,
      last_upload_date: null,
      last_uploader: null
    });
  });
});
// ========== END MAPS ROUTES ==========


const createUploadsDir = () => {
  const uploadsDir = path.join(__dirname, '../uploads');
  const idPhotosDir = path.join(uploadsDir, 'id-photos');

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(idPhotosDir)) {
    fs.mkdirSync(idPhotosDir, { recursive: true });
  }

  console.log('Upload directories ready');
};

createUploadsDir();

// // Initialize Database Tables
// function initializeDatabase() {
//   // Create users table
//   const createUsersTable = `
//     CREATE TABLE IF NOT EXISTS users (
//       id INT AUTO_INCREMENT PRIMARY KEY,
//       name VARCHAR(100) NOT NULL UNIQUE,
//       phone_number VARCHAR(20) NOT NULL UNIQUE,
//       password VARCHAR(255) NOT NULL,
//       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//     )
//   `;

//   // Create customers table (updated with user_id foreign key)
//   const createCustomersTable = `
//     CREATE TABLE IF NOT EXISTS customers (
//       id INT AUTO_INCREMENT PRIMARY KEY,
//       user_id INT NOT NULL,
//       name VARCHAR(255) NOT NULL,
//       budget INT DEFAULT 800,
//       contact TEXT,
//       is_local ENUM('yes', 'no') DEFAULT 'yes',
//       demands TEXT,
//       previous_deal ENUM('rejected', 'successful') DEFAULT 'rejected',
//       notes TEXT,
//       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
//     )
//   `;

//   db.query(createUsersTable, (err) => {
//     if (err) console.error('Error creating users table:', err);
//     else console.log('Users table ready');
//   });

//   db.query(createCustomersTable, (err) => {
//     if (err) console.error('Error creating customers table:', err);
//     else console.log('Customers table ready');
//   });
// }

// Middleware to verify JWT token

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    database: 'MySQL Connected'
  });
});

// Authentication Routes
// Register (Sign Up)
// Register (Sign Up) with all fields
app.post('/api/auth/register', upload.single('id_photo'), async (req, res) => {
  try {
    const {
      name,
      phone_number,
      password,
      date_of_birth,
      national_id,
      fathers_name,
      primary_residence,
      relative1_name,
      relative1_relation,
      relative1_phone,
      relative2_name,
      relative2_relation,
      relative2_phone
    } = req.body;

    // Required fields validation
    if (!name || !phone_number || !password || !national_id) {
      return res.status(400).json({
        error: 'Please provide name, phone number, national ID, and password'
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long'
      });
    }

    // National ID validation (10 digits)
    const nationalIdRegex = /^\d{10}$/;
    if (!nationalIdRegex.test(national_id)) {
      return res.status(400).json({
        error: 'National ID must be 10 digits'
      });
    }

    // Phone number validation (basic)
    const phoneRegex = /^09\d{9}$/;
    if (!phoneRegex.test(phone_number)) {
      return res.status(400).json({
        error: 'Phone number must be 11 digits starting with 09'
      });
    }

    // Date of birth validation
    let parsedDateOfBirth = null;
    if (date_of_birth) {
      parsedDateOfBirth = new Date(date_of_birth);
      if (isNaN(parsedDateOfBirth.getTime())) {
        return res.status(400).json({
          error: 'Invalid date of birth format'
        });
      }

      // Check if user is at least 18 years old
      const eighteenYearsAgo = new Date();
      eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
      if (parsedDateOfBirth > eighteenYearsAgo) {
        return res.status(400).json({
          error: 'User must be at least 18 years old'
        });
      }
    }

    // ID Photo validation
    if (!req.file) {
      return res.status(400).json({
        error: 'ID photo is required'
      });
    }

    // Check if user already exists
    const checkUserQuery = 'SELECT * FROM users WHERE name = ? OR phone_number = ? OR national_id = ?';
    db.query(checkUserQuery, [name, phone_number, national_id], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length > 0) {
        const existingUser = results[0];
        let errorMsg = 'User already exists with ';

        if (existingUser.name === name) {
          errorMsg += 'this username';
        } else if (existingUser.phone_number === phone_number) {
          errorMsg += 'this phone number';
        } else {
          errorMsg += 'this national ID';
        }

        return res.status(400).json({ error: errorMsg });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Prepare file path for database
      const idPhotoPath = `/uploads/id-photos/${req.file.filename}`;

      // Create user with all fields
      const insertUserQuery = `
        INSERT INTO users (
          name, phone_number, password, date_of_birth, national_id, 
          fathers_name, primary_residence, relative1_name, relative1_relation, 
          relative1_phone, relative2_name, relative2_relation, relative2_phone, 
          id_photo_path, approved
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(
        insertUserQuery,
        [
          name,
          phone_number,
          hashedPassword,
          parsedDateOfBirth ? parsedDateOfBirth.toISOString().split('T')[0] : null,
          national_id,
          fathers_name || null,
          primary_residence || null,
          relative1_name || null,
          relative1_relation || null,
          relative1_phone || null,
          relative2_name || null,
          relative2_relation || null,
          relative2_phone || null,
          idPhotoPath,
          1,
          // 0 // Default not approved
        ],
        (err, result) => {
          if (err) {
            console.error('Error creating user:', err);

            // Clean up uploaded file if DB insert fails
            if (req.file) {
              fs.unlinkSync(req.file.path);
            }

            return res.status(500).json({ error: 'Error creating user' });
          }

          // Create JWT token (but user is not approved yet)
          const token = jwt.sign(
            {
              id: result.insertId,
              name: name,
              approved: false,
              is_admin: user.is_admin,
              role: user.role

            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
          );

          res.status(201).json({
            message: 'User registered successfully. Awaiting approval.',
            token,
            user: {
              id: result.insertId,
              name,
              phone_number,
              national_id,
              is_admin: result[0]?.is_admin || false,
              role: result[0]?.role,
              approved: false,
              approval_pending: true
            }
          });
        }
      );
    });
  } catch (error) {
    console.error('Registration error:', error);

    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Server error during registration',
      details: error.message
    });
  }
});

// Login
// Login endpoint - check if user is approved
app.post('/api/auth/login', (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({
        error: 'Please provide name and password'
      });
    }

    const findUserQuery = 'SELECT * FROM users WHERE name = ?';
    db.query(findUserQuery, [name], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const user = results[0];

      // Check if user is approved
      //   if (!user.approved) {
      //     return res.status(403).json({ 
      //       error: 'Account pending approval. Please wait for admin approval.' 
      //     });
      //   }

      // Check password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      // Create JWT token with approval status
      const token = jwt.sign(
        {
          id: user.id,
          name: user.name,
          approved: user.approved,
          is_admin: user.is_admin,
          role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          phone_number: user.phone_number,
          is_admin: user.is_admin,
          role: user.role,
          approved: user.approved,
          approved_at: user.approved_at,
          created_at: user.created_at,
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user profile
app.get('/api/auth/me', verifyTokenAndApproval, (req, res) => {
  // Allow users to check their status even if not approved
  const findUserQuery = 'SELECT id, name, phone_number, approved, approved_at, is_admin FROM users WHERE id = ?';

  db.query(findUserQuery, [req.user.id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: results[0] });
  });
});

// Update the existing customer routes to require authentication
// Get all customers (now user-specific)
// Get all customers (now with creator name)
app.get('/api/customers', verifyTokenAndApproval, (req, res) => {
  checkIsAdmin(req.user.id, (err, is_admin) => {

    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    let getCustomersQuery = `
    SELECT c.*, u.name as creator_name 
    FROM customers c
    JOIN users u ON c.user_id = u.id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `;

    if (is_admin) {
      getCustomersQuery = `
      SELECT c.*, u.name as creator_name 
      FROM customers c
      JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at DESC
    `;
    }

    db.query(getCustomersQuery, is_admin ? [] : [req.user.id], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch customers' });
      }
      res.json(results);
    });
  })
});
// Get single customer by ID (user-specific)
app.get('/api/customers/:id', verifyTokenAndApproval, (req, res) => {
  const getCustomerQuery = `
    SELECT c.*, u.name as creator_name 
    FROM customers c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = ? AND c.user_id = ?
  `;

  db.query(getCustomerQuery, [req.params.id, req.user.id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch customer' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(results[0]);
  });
});
// Create new customer (with user_id)
// Create new customer (with user_id and creator_name)

app.post('/api/customers', verifyTokenAndApproval, (req, res) => {
  const {
    name,
    budget,
    contact,
    isLocal,
    demands,
    previousDeal,
    notes,
    estate_type  // NEW FIELD
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // First get the user's name to store as creator
  const getUserQuery = 'SELECT name FROM users WHERE id = ?';

  db.query(getUserQuery, [req.user.id], (err, userResults) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch user data' });
    }

    if (userResults.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const creatorName = userResults[0].name;

    const insertCustomerQuery = `
      INSERT INTO customers 
      (
        user_id, creator_name, name, budget, contact, 
        is_local, demands, previous_deal, notes, estate_type
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      insertCustomerQuery,
      [
        req.user.id,
        creatorName,
        name,
        budget || 800,
        contact || '',
        isLocal || 'yes',
        demands || '',
        previousDeal || 'rejected',
        notes || '',
        estate_type || null  // NEW FIELD
      ],
      (err, result) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to create customer' });
        }

        // Get the created customer
        const getCustomerQuery = `
          SELECT c.*, u.name as creator_name 
          FROM customers c
          JOIN users u ON c.user_id = u.id
          WHERE c.id = ?
        `;
        db.query(getCustomerQuery, [result.insertId], (err, results) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch created customer' });
          }

          res.status(201).json(results[0]);
        });
      }
    );
  });
});

// Update customer (user-specific)
app.put('/api/customers/:id', verifyTokenAndApproval, (req, res) => {
  const {
    name,
    budget,
    contact,
    isLocal,
    demands,
    previousDeal,
    notes,
    estate_type  // NEW FIELD
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // First check if customer belongs to user
  const checkCustomerQuery = 'SELECT * FROM customers WHERE id = ? AND user_id = ?';
  db.query(checkCustomerQuery, [req.params.id, req.user.id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Update customer with estate_type
    const updateCustomerQuery = `
      UPDATE customers 
      SET 
        name = ?, 
        budget = ?, 
        contact = ?, 
        is_local = ?, 
        demands = ?, 
        previous_deal = ?, 
        notes = ?,
        estate_type = ?
      WHERE id = ? AND user_id = ?
    `;

    db.query(
      updateCustomerQuery,
      [
        name,
        budget || results[0].budget,
        contact || results[0].contact,
        isLocal || results[0].is_local,
        demands || results[0].demands,
        previousDeal || results[0].previous_deal,
        notes || results[0].notes,
        estate_type || results[0].estate_type,  // NEW FIELD
        req.params.id,
        req.user.id
      ],
      (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to update customer' });
        }

        // Get updated customer
        const getUpdatedQuery = `
          SELECT c.*, u.name as creator_name 
          FROM customers c
          JOIN users u ON c.user_id = u.id
          WHERE c.id = ?
        `;
        db.query(getUpdatedQuery, [req.params.id], (err, updatedResults) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch updated customer' });
          }

          res.json(updatedResults[0]);
        });
      }
    );
  });
});
// Delete customer (user-specific)
app.delete('/api/customers/:id', verifyTokenAndApproval, (req, res) => {
  // First check if customer belongs to user
  const checkCustomerQuery = 'SELECT * FROM customers WHERE id = ? AND user_id = ?';
  db.query(checkCustomerQuery, [req.params.id, req.user.id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Delete customer
    const deleteCustomerQuery = 'DELETE FROM customers WHERE id = ? AND user_id = ?';
    db.query(deleteCustomerQuery, [req.params.id, req.user.id], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to delete customer' });
      }

      res.json({ message: 'Customer deleted successfully' });
    });
  });
});

app.get('/api/estates', verifyTokenAndApproval, (req, res) => {
  const getEstateQuery = `
    SELECT e.*, u.name as creator_name 
    FROM estates e
    JOIN users u ON e.user_id = u.id
    -- WHERE e.user_id = ? 
    ORDER BY e.created_at DESC
  `;

  checkIsAdmin(req.user.id, (err, is_admin) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }


    if (!is_admin) {
      return res.status(401).json({ error: 'Authorization error' });
    }

    db.query(getEstateQuery, [req.user.id], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch estates' });
      }

      if (!is_admin) {
        results.forEach(estate => {
          if (estate.user_id != req.user.id) {
            estate.phone_number = '09*********'
          }
        }
        )
      }

      res.json(results);

    });
  })
})

app.get('/api/estates/:id', verifyTokenAndApproval, (req, res) => {
  const getEstateQuery = `
    SELECT e.*, u.name as creator_name 
    FROM estate e
    JOIN users u ON e.user_id = u.id
    WHERE e.id = ? AND e.user_id = ?
  `;

  db.query(getEstateQuery, [req.params.id, req.user.id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch customer' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(results[0]);
  });
})

app.post('/api/estates', verifyTokenAndApproval, (req, res) => {

  const {
    phase,
    project,
    block,
    floor,
    area,
    rooms,
    deed_type,
    total_floors,
    total_units_per_floor,
    occupancy_status,
    notes,
    estate_type,
    phone_number,
    price,
    features
  } = req.body
  // const features = {}

  // return res.status(200).json({ error: 'DONE OK' });

  if (!phase) {
    return res.status(400).json({ error: 'Phase is required' });
  }
  if (!phase || phase < 0) {
    return res.status(400).json({ error: 'Phase can not be less than zero' });
  }

  if (!project || project.length <= 0) {
    return res.status(400).json({ error: 'Project can not be empty' });
  }

  if (!floor || floor < 0) {
    return res.status(400).json({ error: 'Floor must be a non-negative integer' });
  }

  if (!area || area < 0) {
    return res.status(400).json({ error: 'Area must be a non-negative integer' });
  }

  if (!rooms || rooms < 0) {
    return res.status(400).json({ error: 'Rooms must be a non-negative integer' });
  }

  if (!deed_type || deed_type.length <= 0) {
    return res.status(400).json({ error: 'Deed type is required' });
  }

  if (!total_floors) {
    return res.status(400).json({ error: 'Total floors must be a non-negative integer' });
  }

  if (!total_units_per_floor || total_units_per_floor <= 0) {
    return res.status(400).json({ error: 'Floor must be an Integer more than zero' });
  }

  if (!occupancy_status || occupancy_status.length <= 0) {
    return res.status(400).json({ error: 'Occupancy status is required' });
  }

  if (!estate_type || estate_type.length <= 0) {
    return res.status(400).json({ error: 'Estate type is required' });
  }

  const phoneRegex = /^09\d{9}$/;
  if (!phoneRegex.test(phone_number)) {
    return res.status(400).json({
      error: 'Phone number must be 11 digits starting with 09'
    });
  }

  if (!price || price < 0) {
    return res.status(400).json({ error: 'Price must be a non-negative integer' });
  }

  // First get the user's name to store as creator
  const getUserQuery = 'SELECT name FROM users WHERE id = ?';

  db.query(getUserQuery, [req.user.id], (err, userResults) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch user data' });
    }

    if (userResults.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const creatorName = userResults[0].name;

    const insertEstateQuery = `
      INSERT INTO estates 
      (
        user_id, phase, floor, area, rooms, 
        notes, phone_number, price, project,
        estate_type, block, deed_type, occupancy_status,
        total_floors, units_per_floor, features
      ) 
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    db.query(
      insertEstateQuery,
      [
        req.user.id,
        phase,
        floor,
        area,
        rooms,
        notes,
        phone_number,
        price,
        project,
        estate_type,
        block,
        deed_type,
        occupancy_status,
        total_floors,
        total_units_per_floor,
        JSON.stringify(features)
      ],
      (err, result) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to create estate' });
        }

        // Get the created estate
        const getEstateQuery = `
          SELECT e.*, u.name as creator_name 
          FROM estates e
          JOIN users u ON e.user_id = u.id
          WHERE e.id = ?
        `;
        db.query(getEstateQuery, [result.insertId], (err, results) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch created estate' });
          }
          res.status(201).json(results[0]);
        });
      }
    );
  });
})

app.put('/api/estates/:id', verifyTokenAndApproval, (req, res) => {
  const {
    estate_type,
    phase,
    project,
    block,
    floor,
    area,
    rooms,
    features,
    notes,
    phone_number,
    price,
  } = req.body;



  if (!phase) {
    if (phase < 0) {
      return res.status(400).json({ error: 'Phase can not be less than zero' });
    }
    return res.status(400).json({ error: 'Phase is required' });
  }

  if (!block || block.length <= 0) {
    return res.status(400).json({ error: 'Block is required' });
  }

  if (!floor) {
    if (floor < 0) {
      return res.status(400).json({ error: 'Floor can not be less than zero' });
    }
    return res.status(400).json({ error: 'Floor is required' });
  }

  if (!area) {
    if (area <= 0) {
      return res.status(400).json({ error: 'Area can not be zero or less' });
    }
    return res.status(400).json({ error: 'Area is required' });
  }

  if (!rooms) {
    if (rooms < 0) {
      return res.status(400).json({ error: 'Rooms can not be less than zero' });
    }
    return res.status(400).json({ error: 'Rooms is required' });
  }

  const phoneRegex = /^09\d{9}$/;
  if (!phoneRegex.test(phone_number)) {
    return res.status(400).json({
      error: 'Phone number must be 11 digits starting with 09'
    });
  }

  if (!price) {
    if (price < 0) {
      return res.status(400).json({ error: 'Price can not be less than zero' });
    }
    return res.status(400).json({ error: 'Price is required' });
  }

  if (!project || project.length <= 0) {
    return res.status(400).json({ error: 'Project is required' });
  }

  if (!estate_type || estate_type.length <= 0) {
    return res.status(400).json({ error: 'Estate type is required' });
  }

  const checkEstateQuery = 'SELECT * FROM estates WHERE id = ? AND user_id = ?';
  db.query(checkEstateQuery, [req.params.id, req.user.id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Estate not found' });
    }

    const updateEstateQuery = `
      UPDATE estates
      SET 
        estate_type = ?
        phase = ?
        project = ?
        block = ?
        floor = ?
        area = ?
        rooms = ?
        features = ?
        notes = ?
        phone_number = ?
        price = ?
      WHERE id = ? AND user_id = ?
    `;

    db.query(
      updateEstateQuery,
      [
        estate_type || results[0].estate_type,
        phase || results[0].phase,
        project || results[0].project,
        block || results[0].block,
        floor || results[0].floor,
        area || results[0].area,
        rooms || results[0].rooms,
        features || results[0].features,
        notes || results[0].notes,
        phone_number || results[0].phone_number,
        price || results[0].price
      ], (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to update customer' });
        }

        // Get updated customer
        const getUpdatedQuery = `
          SELECT e.*, u.name as creator_name 
          FROM customers e
          JOIN users u ON e.user_id = u.id
          WHERE e.id = ?
        `;
        db.query(getUpdatedQuery, [req.params.id], (err, updatedResults) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch updated customer' });
          }
          res.json(updatedResults[0]);
        });
      }
    )
  })
})
app.delete('/api/estates/:id', verifyTokenAndApproval, (req, res) => {
  // First check if customer belongs to user
  const checkEstateQuery = 'SELECT is_admin FROM users WHERE id = ?';
  db.query(checkEstateQuery, [req.user.id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!results[0]?.is_admin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Delete Estate

    const deleteEstateQuery = 'DELETE FROM estates WHERE id = ? AND user_id = ?';
    db.query(deleteEstateQuery, [req.params.id, req.user.id], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to delete Estate' });
      }

      res.json({ message: 'Estate deleted successfully' });
    });
  });
})

// ========== CONTRACTS ROUTES ==========

// Get all contracts (user-specific or all for admin)
app.get('/api/contracts', verifyTokenAndApproval, (req, res) => {


  checkIsAdmin(req.user.id, (err, isAdmin) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    let query = '';
    let params = [];

    if (isAdmin) {
      // Admin can see all contracts
      query = `
        SELECT 
          c.*,
          u.name as agent_name,
          u.phone_number as agent_phone,
          cust.name as customer_name,
          cust.contact as customer_phone,
          e.project as estate_project,
          e.block as estate_block,
          e.floor as estate_floor,
          e.area as estate_area,
          e.estate_type
        FROM contracts c
        JOIN users u ON c.user_id = u.id
        JOIN customers cust ON c.customer_id = cust.id
        JOIN estates e ON c.estate_id = e.id
        ORDER BY c.created_at DESC
      `;
    } else {
      // Regular users can only see their own contracts
      query = `
        SELECT 
          c.*,
          u.name as agent_name,
          u.phone_number as agent_phone,
          cust.name as customer_name,
          cust.contact as customer_phone,
          e.project as estate_project,
          e.block as estate_block,
          e.floor as estate_floor,
          e.area as estate_area,
          e.estate_type
        FROM contracts c
        JOIN users u ON c.user_id = u.id
        JOIN customers cust ON c.customer_id = cust.id
        JOIN estates e ON c.estate_id = e.id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
      `;
      params = [req.user.id];
    }

    db.query(query, params, (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch contracts' });
      }
      res.json(results);
    });
  });
});

// Get user's customers for dropdown
app.get('/api/contract/customers', verifyTokenAndApproval, (req, res) => {

  if (!req.user.is_admin) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  let query = `
    SELECT id, name, contact
    FROM customers 
    #WHERE user_id = ?
    ORDER BY name
  `;

  db.query(query, [req.user.id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch customers' });
    }
    res.json(results);
  });
});

// Get user's estates for dropdown
app.get('/api/contract/estates', verifyTokenAndApproval, (req, res) => {

  if (!req.user.is_admin) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const query = `
    SELECT id, project, block, floor, area, rooms, estate_type, price
    FROM estates 
    WHERE id NOT IN (
      SELECT estate_id FROM contracts WHERE status = 'فعال'
    )
    ORDER BY project, block
  `;

  db.query(query, [req.user.id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch estates' });
    }
    res.json(results);
  });
});


app.post('/api/test', uploadContract.array('files'), (req, res) => {

  // console.log(req.body);

  // console.log("req.file = ", req.file);

  // console.log("req.files = ", req.files.map((file => file.filename)));

  // console.log("Attachment example:", JSON.stringify(req.files.map(file => `/uploads/contracts/${file.filename}`)));

  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    req.files.forEach((file) => {
      fs.unlinkSync(file.path)
    })
  }

  res.status(422).json({
    message: 'DONE OK'
  })
})


// Create new contract
app.post('/api/contracts', verifyTokenAndApproval, uploadContract.array('files'), (req, res) => {
  const {
    customer_id,
    estate_id,
    contract_type,
    contract_date,
    amount,
    duration_months,
    payment_method,
    commission,
    notes,// Now can be array of objects with {user_id, description, role}
  } = req.body;

  const users = JSON.parse(req.body.users)


  // Validation
  if (!customer_id || !estate_id || !contract_type || !contract_date || !amount) {
    return res.status(400).json({
      error: 'لطفا تمامی فیلدهای الزامی را پر کنید'
    });
  }

  // Validate contract date
  const contractDate = new Date(contract_date);
  if (isNaN(contractDate.getTime())) {
    return res.status(400).json({ error: 'تاریخ قرارداد نامعتبر است' });
  }

  // Validate users array if provided
  if (users && !Array.isArray(users)) {
    return res.status(400).json({ error: 'فیلد users باید آرایه باشد' });
  }

  // Check if customer belongs to user
  const checkCustomerQuery = 'SELECT * FROM customers WHERE id = ?';
  db.query(checkCustomerQuery, [customer_id], (err, customerResults) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (customerResults.length === 0) {
      return res.status(404).json({ error: 'مشتری یافت نشد یا دسترسی ندارید' });
    }

    // Check if estate belongs to user
    const checkEstateQuery = 'SELECT * FROM estates WHERE id = ?';
    db.query(checkEstateQuery, [estate_id], (err, estateResults) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (estateResults.length === 0) {
        return res.status(404).json({ error: 'ملک یافت نشد یا دسترسی ندارید' });
      }

      // Check if estate already has active contract
      const checkActiveContractQuery = 'SELECT * FROM contracts WHERE estate_id = ? AND status = "فعال"';
      db.query(checkActiveContractQuery, [estate_id], (err, activeContracts) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (activeContracts.length > 0) {
          return res.status(400).json({
            error: 'این ملک قبلاً دارای قرارداد فعال است'
          });
        }

        // Generate contract number
        const contract_number = generateContractNumber();

        let attachments = req.files
        for (let i = 0; i < attachments.length; i++) {
          const file = attachments[i];
          file.path = `/uploads/contracts/${file.filename}`;
        }
        attachments = JSON.stringify(attachments);

        db.getConnection((err, conn) => {

          if (err) {
            return res.status(500).json({ error: 'Transaction error' });
          }
          // Start transaction for atomic operations

          conn.beginTransaction((err) => {
            if (err) {
              console.error('Transaction error:', err);
              return res.status(500).json({ error: 'Transaction error' });
            }

            // Insert contract
            const insertContractQuery = `
            INSERT INTO contracts (
              contract_number, user_id, customer_id, estate_id, 
              contract_type, contract_date, amount, duration_months,
              payment_method, commission, notes, status, attachments
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

            conn.query(
              insertContractQuery,
              [
                contract_number,
                req.user.id, // Primary user (creator)
                customer_id,
                estate_id,
                contract_type,
                contractDate.toISOString().split('T')[0],
                amount,
                duration_months || null,
                payment_method || 'نقدی',
                commission || 0,
                notes || '',
                'فعال',
                attachments
              ],
              (err, result) => {
                if (err) {
                  return conn.rollback(() => {
                    console.error('Database error:', err);
                    res.status(500).json({ error: 'Failed to create contract' });
                  });
                }

                const contractId = result.insertId;

                // Handle pivot table entries for multiple users with description
                const handlePivotTable = (callback) => {
                  // Always add the creator first
                  const insertCreatorQuery = `
                  INSERT INTO contract_users (contract_id, user_id, description, role)
                  VALUES (?, ?, ?, ?)
                `;

                  // Add creator with optional description
                  const creatorDescription = req.body.creator_description || 'سازنده قرارداد';

                  // conn.query(insertCreatorQuery, [
                  //   contractId,
                  //   req.user.id,
                  //   creatorDescription,
                  //   'creator'
                  // ], (err) => {});
                  // if (err) return callback(err);

                  // If no additional users specified, we're done
                  if (!users || users.length === 0) {
                    return callback(null);
                  }

                  // Process additional users
                  const userValues = users.map(user => {
                    // Support both object format and simple ID format
                    let userId, description, role;

                    if (typeof user === 'object' && user !== null) {
                      userId = user.user_id || user.id;
                      description = user.description || null;
                      role = user.role || 'collaborator';
                    } else {
                      // Simple ID format
                      userId = user;
                      description = null;
                      role = 'collaborator';
                    }

                    // Skip if it's the creator (already added)
                    if (parseInt(userId) === parseInt(req.user.id)) {
                      return null;
                    }

                    return [contractId, userId, description, role];
                  }).filter(value => value !== null); // Remove null entries

                  if (userValues.length === 0) {
                    return callback(null);
                  }

                  const insertUsersQuery = `
                    INSERT INTO contract_users (contract_id, user_id, description, role)
                    VALUES ?
                  `;

                  conn.query(insertUsersQuery, [userValues], (err) => {
                    if (err) return callback(err);
                    callback(null);
                  });

                };

                // Insert into pivot table
                handlePivotTable((err) => {

                  console.log("ERROR: ", err);


                  if (err) {
                    return conn.rollback(() => {
                      console.error('Database error:', err);
                      res.status(500).json({ error: 'Failed to add users to contract' });
                    });
                  }

                  // Commit transaction
                  conn.commit((err) => {
                    if (err) {
                      return conn.rollback(() => {
                        console.error('Commit error:', err);
                        res.status(500).json({ error: 'Transaction failed' });
                      });
                    }

                    // Get the created contract with details and users
                    const getContractQuery = `
                    SELECT 
                      c.*,
                      u.name as agent_name,
                      u.phone_number as agent_phone,
                      cust.name as customer_name,
                      cust.contact as customer_phone,
                      e.project as estate_project,
                      e.block as estate_block,
                      e.floor as estate_floor,
                      e.area as estate_area,
                      e.estate_type,
                      GROUP_CONCAT(
                        CONCAT(
                          cu.user_id, ':', 
                          COALESCE(cu.role, 'collaborator'), ':', 
                          COALESCE(cu.description, '')
                        )
                      ) as user_details
                    FROM contracts c
                    JOIN users u ON c.user_id = u.id
                    JOIN customers cust ON c.customer_id = cust.id
                    JOIN estates e ON c.estate_id = e.id
                    LEFT JOIN contract_users cu ON c.id = cu.contract_id
                    WHERE c.id = ?
                    GROUP BY c.id
                  `;

                    conn.query(getContractQuery, [contractId], (err, contractResults) => {
                      if (err) {
                        console.error('Database error:', err);
                        // Still return success since contract was created
                        return res.status(201).json({
                          id: contractId,
                          contract_number,
                          message: 'قرارداد با موفقیت ایجاد شد'
                        });
                      }

                      const contract = contractResults[0];

                      // Parse the associated users with description
                      if (contract.user_details) {
                        contract.associated_users = contract.user_details.split(',').map(detail => {
                          const [userId, role, description] = detail.split(':');
                          return {
                            user_id: parseInt(userId),
                            role: role || 'collaborator',
                            description: description || null
                          };
                        });

                        // Remove the raw field
                        delete contract.user_details;
                      }

                      res.status(201).json(contract);
                    });
                  });
                });
              }
            );
          });
        });
      });
    });
  });
});

// Get contract with all associated users (including description)
app.get('/api/contracts/:id/users', verifyTokenAndApproval, (req, res) => {

  const contractId = req.params.id;

  const query = `
    SELECT 
      cu.*,
      u.name,
      u.phone_number
    FROM contract_users cu
    JOIN users u ON cu.user_id = u.id
    WHERE cu.contract_id = ?
    ORDER BY
      cu.created_at
  `;

  db.query(query, [contractId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(results);
  });
});

// Add user to contract with description
app.post('/api/contracts/:id/users', verifyTokenAndApproval, (req, res) => {
  const contractId = req.params.id;
  const { user_id, description = null, role = 'collaborator' } = req.body;

  // Validate user exists
  const checkUserQuery = 'SELECT id FROM users WHERE id = ?';
  db.query(checkUserQuery, [user_id], (err, userResults) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (userResults.length === 0) {
      return res.status(404).json({ error: 'کاربر یافت نشد' });
    }

    // Check if user is already associated
    const checkExistingQuery = 'SELECT * FROM contract_users WHERE contract_id = ? AND user_id = ?';
    db.query(checkExistingQuery, [contractId, user_id], (err, existingResults) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      let query, params;

      if (existingResults.length > 0) {
        // Update existing entry
        query = `
          UPDATE contract_users 
          SET description = ?, role = ?, created_at = CURRENT_TIMESTAMP
          WHERE contract_id = ? AND user_id = ?
        `;
        params = [description, role, contractId, user_id];
      } else {
        // Insert new entry
        query = `
          INSERT INTO contract_users (contract_id, user_id, description, role)
          VALUES (?, ?, ?, ?)
        `;
        params = [contractId, user_id, description, role];
      }

      db.query(query, params, (err, result) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to add/update user in contract' });
        }

        res.status(201).json({
          message: existingResults.length > 0 ? 'اطلاعات کاربر به‌روزرسانی شد' : 'کاربر با موفقیت به قرارداد اضافه شد'
        });
      });
    });
  });
});

// Update user description/role in contract
app.put('/api/contracts/:id/users/:userId', verifyTokenAndApproval, (req, res) => {
  const { id: contractId, userId } = req.params;
  const { description = null, role } = req.body;

  // Prevent updating creator role
  if (role && role !== 'creator') {
    const checkCreatorQuery = 'SELECT role FROM contract_users WHERE contract_id = ? AND user_id = ?';

    db.query(checkCreatorQuery, [contractId, userId], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length > 0 && results[0].role === 'creator' && role !== 'creator') {
        return res.status(400).json({
          error: 'نمی‌توان نقش سازنده قرارداد را تغییر داد'
        });
      }

      performUpdate();
    });
  } else {
    performUpdate();
  }

  function performUpdate() {
    const updateQuery = `
      UPDATE contract_users 
      SET description = ?, ${role !== undefined ? 'role = ?,' : ''} updated_at = CURRENT_TIMESTAMP
      WHERE contract_id = ? AND user_id = ?
    `;

    const params = role !== undefined
      ? [description, role, contractId, userId]
      : [description, contractId, userId];

    // Remove trailing comma if role wasn't included
    const finalQuery = updateQuery.replace(', WHERE', ' WHERE');

    db.query(finalQuery, params, (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to update user information' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'ارتباط کاربر با قرارداد یافت نشد' });
      }

      res.json({ message: 'اطلاعات کاربر با موفقیت به‌روزرسانی شد' });
    });
  }
});
// Remove user from contract
app.delete('/api/contracts/:id/users/:userId', verifyTokenAndApproval, (req, res) => {
  const { id: contractId, userId } = req.params;

  // Prevent removing the creator
  const checkCreatorQuery = 'SELECT role FROM contract_users WHERE contract_id = ? AND user_id = ?';

  db.query(checkCreatorQuery, [contractId, userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length > 0 && results[0].role === 'creator') {
      return res.status(400).json({ error: 'نمی‌توان سازنده قرارداد را حذف کرد' });
    }

    const deleteQuery = 'DELETE FROM contract_users WHERE contract_id = ? AND user_id = ?';

    db.query(deleteQuery, [contractId, userId], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to remove user from contract' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'ارتباط کاربر با قرارداد یافت نشد' });
      }

      res.json({ message: 'کاربر با موفقیت از قرارداد حذف شد' });
    });
  });
});

// Update contract
app.put('/api/contracts/:id', verifyTokenAndApproval, uploadContract.array('files'), (req, res) => {

  const contractId = req.params.id;
  const {
    contract_type,
    contract_date,
    amount,
    duration_months,
    payment_method,
    commission,
    status,
    notes
  } = req.body;

  // First check if contract belongs to user (or user is admin)
  checkIsAdmin(req.user.id, (err, isAdmin) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    let checkQuery = '';
    let checkParams = [];

    if (isAdmin) {
      checkQuery = 'SELECT * FROM contracts WHERE id = ?';
      checkParams = [contractId];
    } else {
      checkQuery = 'SELECT * FROM contracts WHERE id = ? AND user_id = ?';
      checkParams = [contractId, req.user.id];
    }

    db.query(checkQuery, checkParams, (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'قرارداد یافت نشد یا دسترسی ندارید' });
      }

      const currentContract = results[0];

      // Validate contract date if provided
      let contractDate = currentContract.contract_date;
      if (contract_date) {
        const newDate = new Date(contract_date);
        if (isNaN(newDate.getTime())) {
          return res.status(400).json({ error: 'تاریخ قرارداد نامعتبر است' });
        }
        contractDate = newDate.toISOString().split('T')[0];
      }

      // Update contract
      const updateContractQuery = `
        UPDATE contracts 
        SET 
          contract_type = ?,
          contract_date = ?,
          amount = ?,
          duration_months = ?,
          payment_method = ?,
          commission = ?,
          status = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      db.query(
        updateContractQuery,
        [
          contract_type || currentContract.contract_type,
          contractDate,
          amount || currentContract.amount,
          duration_months !== undefined ? duration_months : currentContract.duration_months,
          payment_method || currentContract.payment_method,
          commission !== undefined ? commission : currentContract.commission,
          status || currentContract.status,
          notes || currentContract.notes,
          contractId
        ],
        (err) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to update contract' });
          }

          // Get updated contract
          const getUpdatedQuery = `
            SELECT 
              c.*,
              u.name as agent_name,
              u.phone_number as agent_phone,
              cust.name as customer_name,
              cust.contact as customer_phone,
              e.project as estate_project,
              e.block as estate_block,
              e.floor as estate_floor,
              e.area as estate_area,
              e.estate_type
            FROM contracts c
            JOIN users u ON c.user_id = u.id
            JOIN customers cust ON c.customer_id = cust.id
            JOIN estates e ON c.estate_id = e.id
            WHERE c.id = ?
          `;

          db.query(getUpdatedQuery, [contractId], (err, updatedResults) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Failed to fetch updated contract' });
            }

            res.json(updatedResults[0]);
          });
        }
      );
    });
  });
});

// Delete contract (admin only)
app.delete('/api/contracts/:id', verifyTokenAndApproval, (req, res) => {
  // Check if user is admin
  checkIsAdmin(req.user.id, (err, isAdmin) => {
    if (err || !isAdmin) {
      return res.status(403).json({ error: 'دسترسی ادمین مورد نیاز است' });
    }

    // First check if contract exists
    const checkQuery = 'SELECT * FROM contracts WHERE id = ?';
    db.query(checkQuery, [req.params.id], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'قرارداد یافت نشد' });
      }

      // Delete contract
      const deleteQuery = 'DELETE FROM contracts WHERE id = ?';
      db.query(deleteQuery, [req.params.id], (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to delete contract' });
        }

        res.json({ message: 'قرارداد با موفقیت حذف شد' });
      });
    });
  });
});

// Get contracts statistics
app.get('/api/contracts/stats', verifyTokenAndApproval, (req, res) => {
  checkIsAdmin(req.user.id, (err, isAdmin) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    let statsQuery = '';
    let params = [];

    if (isAdmin) {
      statsQuery = `
        SELECT 
          COUNT(*) as total_contracts,
          SUM(amount) as total_amount,
          AVG(amount) as average_amount,
          SUM(commission) as total_commission,
          COUNT(CASE WHEN status = 'فعال' THEN 1 END) as active_contracts,
          COUNT(CASE WHEN status = 'منقضی' THEN 1 END) as expired_contracts,
          COUNT(CASE WHEN MONTH(contract_date) = MONTH(CURRENT_DATE()) 
                    AND YEAR(contract_date) = YEAR(CURRENT_DATE()) 
                    THEN 1 END) as this_month,
          MAX(contract_date) as latest_contract_date
        FROM contracts
      `;
    } else {
      statsQuery = `
        SELECT 
          COUNT(*) as total_contracts,
          SUM(amount) as total_amount,
          AVG(amount) as average_amount,
          SUM(commission) as total_commission,
          COUNT(CASE WHEN status = 'فعال' THEN 1 END) as active_contracts,
          COUNT(CASE WHEN status = 'منقضی' THEN 1 END) as expired_contracts,
          COUNT(CASE WHEN MONTH(contract_date) = MONTH(CURRENT_DATE()) 
                    AND YEAR(contract_date) = YEAR(CURRENT_DATE()) 
                    THEN 1 END) as this_month,
          MAX(contract_date) as latest_contract_date
        FROM contracts
        WHERE user_id = ?
      `;
      params = [req.user.id];
    }

    db.query(statsQuery, params, (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch contract statistics' });
      }

      res.json(results[0] || {
        total_contracts: 0,
        total_amount: 0,
        average_amount: 0,
        total_commission: 0,
        active_contracts: 0,
        expired_contracts: 0,
        this_month: 0,
        latest_contract_date: null
      });
    });
  });
});

// Get single contract by ID
app.get('/api/contracts/:id', verifyTokenAndApproval, (req, res) => {
  const contractId = req.params.id;

  checkIsAdmin(req.user.id, (err, isAdmin) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    let query = '';
    let params = [];

    if (isAdmin) {
      query = `
        SELECT 
          c.*,
          u.name as agent_name,
          u.phone_number as agent_phone,
          cust.name as customer_name,
          cust.contact as customer_phone,
          cust.contact as customer_contact,
          e.project as estate_project,
          e.block as estate_block,
          e.floor as estate_floor,
          e.area as estate_area,
          e.rooms as estate_rooms,
          e.estate_type,
          e.phone_number as estate_phone,
          e.price as estate_price
        FROM contracts c
        JOIN users u ON c.user_id = u.id
        JOIN customers cust ON c.customer_id = cust.id
        JOIN estates e ON c.estate_id = e.id
        WHERE c.id = ?
      `;
      params = [contractId];
    } else {
      res.status(401).json({ error: "Unauthorized" })
    }

    db.query(query, params, (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch contract' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      // console.log(results[0].attachments);


      res.json(results[0]);
    });
  });
});


// ========== END CONTRACTS ROUTES ==========


// Admin routes
// Admin only: Get all pending users
app.get('/api/admin/pending-users', verifyTokenAndApproval, (req, res) => {
  // Check if user is admin (you need to add admin field to users table)
  const checkAdminQuery = 'SELECT is_admin FROM users WHERE id = ?';

  db.query(checkAdminQuery, [req.user.id], (err, results) => {
    if (err || !results[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const getPendingUsersQuery = `
      SELECT 
        id, name, phone_number, national_id, fathers_name, 
        primary_residence, created_at, approved, approved_at
      FROM users 
      WHERE approved = 0 
      ORDER BY created_at DESC
    `;

    db.query(getPendingUsersQuery, (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch pending users' });
      }
      res.json(results);
    });
  });
});

// Admin only: Approve user
app.post('/api/admin/approve-user/:userId', verifyTokenAndApproval, (req, res) => {
  const checkAdminQuery = 'SELECT is_admin FROM users WHERE id = ?';

  db.query(checkAdminQuery, [req.user.id], (err, results) => {
    if (err || !results[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const approveUserQuery = `
      UPDATE users 
      SET approved = 1, approved_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;

    db.query(approveUserQuery, [req.params.userId], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to approve user' });
      }

      res.json({ message: 'User approved successfully' });
    });
  });
});

// Admin only: Reject user (delete)
app.delete('/api/admin/reject-user/:userId', verifyTokenAndApproval, (req, res) => {
  const checkAdminQuery = 'SELECT is_admin FROM users WHERE id = ?';

  db.query(checkAdminQuery, [req.user.id], (err, results) => {
    if (err || !results[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // First get user to delete their ID photo
    const getUserQuery = 'SELECT id_photo_path FROM users WHERE id = ?';
    db.query(getUserQuery, [req.params.userId], (err, userResults) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch user' });
      }

      // Delete ID photo file
      if (userResults[0]?.id_photo_path) {
        const photoPath = path.join(__dirname, '..', userResults[0].id_photo_path);
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
        }
      }

      // Delete user
      const deleteUserQuery = 'DELETE FROM users WHERE id = ?';
      db.query(deleteUserQuery, [req.params.userId], (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to reject user' });
        }

        res.json({ message: 'User rejected and removed successfully' });
      });
    });
  });
});

app.get('/api/users', verifyTokenAndApproval, (req, res) => {

  // Check if user is requesting their own data or is admin
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Parse query parameters
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;

  // Validate inputs
  if (limit <= 0 || limit > 100) {
    return res.status(400).json({ error: 'Limit must be between 1 and 100' });
  }

  if (offset < 0) {
    return res.status(400).json({ error: 'Offset cannot be negative' });
  }

  const getUserQuery = `
    SELECT
      id, name, phone_number
    FROM users
    ORDER BY id ASC
    LIMIT ?
    OFFSET ?
  `;

  db.query(getUserQuery, [limit, offset], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    res.json(results); // Changed from results[0] to results to return all users in the page
  });
});

app.get('/api/users/select-list', verifyTokenAndApproval, (req, res) => {

  // console.log(req.user);

  // Check if user is admin (only admins can create contracts)
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const getUserQuery = `
    SELECT
      id, 
      name, 
      phone_number, 
      role,
      CONCAT(name, ' - ', phone_number, ' (', role, ')') as display_text
    FROM users
    WHERE approved = 1
    ORDER BY name ASC
  `;

  db.query(getUserQuery, [], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    res.json(results);
  });
});

// Get user by ID (admin only or self)
app.get('/api/users/:id', verifyTokenAndApproval, (req, res) => {
  const userId = req.params.id;

  // Check if user is requesting their own data or is admin
  if (req.user.id != userId && !req.user.is_admin) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const getUserQuery = `
    SELECT 
      id, name, phone_number, date_of_birth, national_id, fathers_name,
      primary_residence, relative1_name, relative1_relation, relative1_phone,
      relative2_name, relative2_relation, relative2_phone, id_photo_path,
      approved, approved_at, created_at, updated_at
    FROM users 
    WHERE id = ?
  `;

  db.query(getUserQuery, [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(results[0]);
  });
});

app.get('/api/users/', verifyTokenAndApproval, (req, res) => {

  // Check if user is requesting their own data or is admin
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Parse query parameters
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;

  // Validate inputs
  if (limit <= 0 || limit > 100) {
    return res.status(400).json({ error: 'Limit must be between 1 and 100' });
  }

  if (offset < 0) {
    return res.status(400).json({ error: 'Offset cannot be negative' });
  }

  const getUserQuery = `
    SELECT
      id, name, phone_number
    FROM users
    ORDER BY id ASC
    LIMIT ?
    OFFSET ?
  `;

  db.query(getUserQuery, [limit, offset], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    res.json(results); // Changed from results[0] to results to return all users in the page
  });
});


app.put('/api/users/:id', verifyTokenAndApproval, (req, res) => {
  const userId = req.params.id;
  const { name, phone_number, fathers_name, date_of_birth, primary_residence } = req.body;

  // Check if user is updating their own data
  if (req.user.id != userId && !req.user.is_admin) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Validation
  if (!name || !phone_number) {
    return res.status(400).json({ error: 'Name and phone number are required' });
  }

  const updateUserQuery = `
    UPDATE users 
    SET name = ?, phone_number = ?, fathers_name = ?, 
        date_of_birth = ?, primary_residence = ?
    WHERE id = ?
  `;

  db.query(
    updateUserQuery,
    [
      name,
      phone_number,
      fathers_name || null,
      date_of_birth || null,
      primary_residence || null,
      userId
    ],
    (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to update user' });
      }

      // Get updated user data
      const getUserQuery = 'SELECT * FROM users WHERE id = ?';
      db.query(getUserQuery, [userId], (err, results) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to fetch updated user' });
        }

        res.json(results[0]);
      });
    }
  );
});

app.post('/api/auth/change-password', verifyTokenAndApproval, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    // Get current user
    const getUserQuery = 'SELECT * FROM users WHERE id = ?';
    db.query(getUserQuery, [req.user.id], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = results[0];

      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update password
      const updatePasswordQuery = 'UPDATE users SET password = ? WHERE id = ?';
      db.query(updatePasswordQuery, [hashedPassword, req.user.id], (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to update password' });
        }

        res.json({ message: 'Password updated successfully' });
      });
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve Vue app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log(`Database: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
});