const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const multer = require('multer'); // Add this
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://94.182.92.245', 'http://localhost:5173'],
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
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};


// MySQL Database Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ========== FILE UPLOAD CONFIGURATION ==========
// Configure file upload storage
const storage = multer.diskStorage({
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
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|bmp|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      cb(new Error('File size exceeds 2MB limit'), false);
    } else {
      cb(null, true);
    }
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Create upload middleware instance
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});
// ========== END FILE UPLOAD CONFIG ==========

// ========== MAPS ROUTES ==========

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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
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

      console.log("Is admin");
      

      const { title, description, uploaded_by } = req.body;

      console.log('Data received', title, description, uploaded_by);
      
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


// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL database');
  
  // Initialize database tables
//   initializeDatabase();
});

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
              approved: false 
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
          approved: user.approved 
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
  const findUserQuery = 'SELECT id, name, phone_number, approved, approved_at FROM users WHERE id = ?';
  
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
  const getCustomersQuery = `
    SELECT c.*, u.name as creator_name 
    FROM customers c
    JOIN users u ON c.user_id = u.id
    WHERE c.user_id = ? 
    ORDER BY c.created_at DESC
  `;
  
  db.query(getCustomersQuery, [req.user.id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch customers' });
    }
    res.json(results);
  });
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

// Get user by ID (admin only or self)
app.get('/api/users/:id', verifyTokenAndApproval, (req, res) => {
  const userId = req.params.id;
  
  // Check if user is requesting their own data or is admin
  if (req.user.id != userId && !req.user.isAdmin) {
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

app.put('/api/users/:id', verifyTokenAndApproval, (req, res) => {
  const userId = req.params.id;
  const { name, phone_number, fathers_name, date_of_birth, primary_residence } = req.body;
  
  // Check if user is updating their own data
  if (req.user.id != userId && !req.user.isAdmin) {
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