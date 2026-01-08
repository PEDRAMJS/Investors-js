const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
require('dotenv').config()

// Import Prisma
const { PrismaClient } = require('@prisma/client')

const app = express()
const PORT = process.env.PORT || 3000

// Initialize Prisma Client
const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
});


// Middleware
app.use(cors({
  origin: ['http://94.182.92.245', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

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

// ========== MAPS API ==========
// Configure file upload for maps (separate from ID photos)
const mapStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/maps');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const ext = path.extname(file.originalname);
    const filename = `map_${timestamp}_${random}${ext}`;
    cb(null, filename);
  }
});

const mapUpload = multer({ 
  storage: mapStorage,
  fileFilter: fileFilter, // Reuse the same file filter
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for maps
});

// Get all maps (public access, but requires authentication)
app.get('/api/maps', verifyToken, (req, res) => {
  const getMapsQuery = `
    SELECT m.*, u.name as uploaded_by_name 
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
app.get('/api/maps/:id', verifyToken, (req, res) => {
  const getMapQuery = `
    SELECT m.*, u.name as uploaded_by_name 
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

// Upload new map (admin only)
app.post('/api/maps', verifyToken, mapUpload.single('map_file'), (req, res) => {
  // Check if user is admin
  const checkAdminQuery = 'SELECT is_admin FROM users WHERE id = ?';
  
  db.query(checkAdminQuery, [req.user.id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!results[0]?.is_admin) {
      // Delete uploaded file if not admin
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { title, description } = req.body;
    
    if (!title || !req.file) {
      // Delete uploaded file if validation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Title and file are required' });
    }
    
    const filePath = `/uploads/maps/${req.file.filename}`;
    
    const insertMapQuery = `
      INSERT INTO maps 
      (title, description, file_path, file_size, file_type, uploaded_by, uploaded_by_name) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.query(
      insertMapQuery,
      [
        title,
        description || '',
        filePath,
        req.file.size,
        req.file.mimetype,
        req.user.id,
        req.user.name
      ],
      (err, result) => {
        if (err) {
          console.error('Database error:', err);
          // Delete uploaded file if DB insert fails
          if (req.file) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(500).json({ error: 'Failed to save map' });
        }
        
        // Get the created map
        const getMapQuery = 'SELECT * FROM maps WHERE id = ?';
        db.query(getMapQuery, [result.insertId], (err, results) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch created map' });
          }
          
          res.status(201).json(results[0]);
        });
      }
    );
  });
});

// Update map (admin only)
app.put('/api/maps/:id', verifyToken, (req, res) => {
  // Check if user is admin
  const checkAdminQuery = 'SELECT is_admin FROM users WHERE id = ?';
  
  db.query(checkAdminQuery, [req.user.id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!results[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { title, description } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const updateMapQuery = `
      UPDATE maps 
      SET title = ?, description = ? 
      WHERE id = ?
    `;
    
    db.query(
      updateMapQuery,
      [title, description || '', req.params.id],
      (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to update map' });
        }
        
        // Get updated map
        const getMapQuery = 'SELECT * FROM maps WHERE id = ?';
        db.query(getMapQuery, [req.params.id], (err, results) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch updated map' });
          }
          
          res.json(results[0]);
        });
      }
    );
  });
});

// Delete map (admin only)
app.delete('/api/maps/:id', verifyToken, (req, res) => {
  // Check if user is admin
  const checkAdminQuery = 'SELECT is_admin FROM users WHERE id = ?';
  
  db.query(checkAdminQuery, [req.user.id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!results[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // First get map to delete file
    const getMapQuery = 'SELECT file_path FROM maps WHERE id = ?';
    db.query(getMapQuery, [req.params.id], (err, mapResults) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch map' });
      }
      
      if (mapResults.length === 0) {
        return res.status(404).json({ error: 'Map not found' });
      }
      
      // Delete file from filesystem
      const filePath = path.join(__dirname, '..', mapResults[0].file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // Delete from database
      const deleteMapQuery = 'DELETE FROM maps WHERE id = ?';
      db.query(deleteMapQuery, [req.params.id], (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to delete map' });
        }
        
        res.json({ message: 'Map deleted successfully' });
      });
    });
  });
});

// Serve map files
app.use('/uploads/maps', express.static(path.join(__dirname, '../uploads/maps')));
// ========== END MAPS API ==========

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

// Connect to Prisma (test connection)
prisma.$connect()
  .then(() => {
    console.log('Connected to MySQL database via Prisma');
  })
  .catch((err) => {
    console.error('Error connecting to database:', err);
    process.exit(1);
  });

// Middleware to verify JWT token
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

// Routes
app.get('/api/health', async (req, res) => {
  try {
    // Test Prisma connection
    await prisma.$queryRaw`SELECT 1`

    res.json({
      status: 'OK',
      message: 'Server is running',
      database: 'Prisma 7 + MySQL Connected',
      prisma: 'Prisma 7 configured successfully'
    })
  } catch (error) {
    console.error('Health check failed:', error)
    res.status(500).json({
      status: 'ERROR',
      message: 'Database connection failed',
      error: error.message
    })
  }
})

// Authentication Routes
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
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [
          { name: name },
          { phone_number: phone_number },
          { national_id: national_id }
        ]
      }
    });

    if (existingUser) {
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

    // Create user with all fields using Prisma
    const newUser = await prisma.users.create({
      data: {
        name,
        phone_number,
        password: hashedPassword,
        date_of_birth: parsedDateOfBirth ? parsedDateOfBirth : null,
        national_id,
        fathers_name: fathers_name || null,
        primary_residence: primary_residence || null,
        relative1_name: relative1_name || null,
        relative1_relation: relative1_relation || null,
        relative1_phone: relative1_phone || null,
        relative2_name: relative2_name || null,
        relative2_relation: relative2_relation || null,
        relative2_phone: relative2_phone || null,
        id_photo_path: idPhotoPath,
        approved: false
      }
    });

    // Create JWT token (but user is not approved yet)
    const token = jwt.sign(
      {
        id: newUser.id,
        name: newUser.name,
        approved: newUser.approved
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'User registered successfully. Awaiting approval.',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        phone_number: newUser.phone_number,
        national_id: newUser.national_id,
        approved: newUser.approved,
        approval_pending: true
      }
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

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({
        error: 'Please provide name and password'
      });
    }

    // Find user using Prisma
    const user = await prisma.users.findUnique({
      where: { name: name }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

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
        approved: user.approved,
        approved_at: user.approved_at,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user profile
app.get('/api/auth/me', verifyTokenAndApproval, async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        phone_number: true,
        approved: true,
        approved_at: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all customers (user-specific)
app.get('/api/customers', verifyTokenAndApproval, async (req, res) => {
  try {
    const customers = await prisma.customers.findMany({
      where: {
        user_id: req.user.id
      },
      include: {
        user: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Format response to include creator_name
    const formattedCustomers = customers.map(customer => ({
      ...customer,
      creator_name: customer.user.name
    }));

    res.json(formattedCustomers);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get single customer by ID (user-specific)
app.get('/api/customers/:id', verifyTokenAndApproval, async (req, res) => {
  try {
    const customer = await prisma.customers.findFirst({
      where: {
        id: parseInt(req.params.id),
        user_id: req.user.id
      },
      include: {
        user: {
          select: {
            name: true
          }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Format response to include creator_name
    const formattedCustomer = {
      ...customer,
      creator_name: customer.user.name
    };

    res.json(formattedCustomer);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// Create new customer
app.post('/api/customers', verifyTokenAndApproval, async (req, res) => {
  try {
    const {
      name,
      budget,
      contact,
      isLocal,
      demands,
      previousDeal,
      notes,
      estate_type
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Get user to get creator name
    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: { name: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create customer using Prisma
    const newCustomer = await prisma.customers.create({
      data: {
        user_id: req.user.id,
        creator_name: user.name,
        name,
        budget: budget || 800,
        contact: contact || '',
        is_local: isLocal || 'yes',
        demands: demands || '',
        previous_deal: previousDeal || 'rejected',
        notes: notes || '',
        estate_type: estate_type || null
      },
      include: {
        user: {
          select: {
            name: true
          }
        }
      }
    });

    // Format response
    const formattedCustomer = {
      ...newCustomer,
      creator_name: newCustomer.user.name
    };

    res.status(201).json(formattedCustomer);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update customer
app.put('/api/customers/:id', verifyTokenAndApproval, async (req, res) => {
  try {
    const {
      name,
      budget,
      contact,
      isLocal,
      demands,
      previousDeal,
      notes,
      estate_type
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check if customer belongs to user
    const existingCustomer = await prisma.customers.findFirst({
      where: {
        id: parseInt(req.params.id),
        user_id: req.user.id
      }
    });

    if (!existingCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Update customer using Prisma
    const updatedCustomer = await prisma.customers.update({
      where: {
        id: parseInt(req.params.id)
      },
      data: {
        name,
        budget: budget || existingCustomer.budget,
        contact: contact || existingCustomer.contact,
        is_local: isLocal || existingCustomer.is_local,
        demands: demands || existingCustomer.demands,
        previous_deal: previousDeal || existingCustomer.previous_deal,
        notes: notes || existingCustomer.notes,
        estate_type: estate_type || existingCustomer.estate_type
      },
      include: {
        user: {
          select: {
            name: true
          }
        }
      }
    });

    // Format response
    const formattedCustomer = {
      ...updatedCustomer,
      creator_name: updatedCustomer.user.name
    };

    res.json(formattedCustomer);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete customer
app.delete('/api/customers/:id', verifyTokenAndApproval, async (req, res) => {
  try {
    // Check if customer belongs to user
    const existingCustomer = await prisma.customers.findFirst({
      where: {
        id: parseInt(req.params.id),
        user_id: req.user.id
      }
    });

    if (!existingCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Delete customer using Prisma
    await prisma.customers.delete({
      where: {
        id: parseInt(req.params.id)
      }
    });

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// Admin routes
// Get all pending users
app.get('/api/admin/pending-users', verifyTokenAndApproval, async (req, res) => {
  try {
    // Check if user is admin
    const adminUser = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: { is_admin: true }
    });

    if (!adminUser || !adminUser.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const pendingUsers = await prisma.users.findMany({
      where: {
        approved: false
      },
      select: {
        id: true,
        name: true,
        phone_number: true,
        national_id: true,
        fathers_name: true,
        primary_residence: true,
        created_at: true,
        approved: true,
        approved_at: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    res.json(pendingUsers);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch pending users' });
  }
});

// Approve user (admin only)
app.post('/api/admin/approve-user/:userId', verifyTokenAndApproval, async (req, res) => {
  try {
    // Check if user is admin
    const adminUser = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: { is_admin: true }
    });

    if (!adminUser || !adminUser.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Update user approval status
    const updatedUser = await prisma.users.update({
      where: {
        id: parseInt(req.params.userId)
      },
      data: {
        approved: true,
        approved_at: new Date()
      }
    });

    res.json({ message: 'User approved successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// Reject user (admin only)
app.delete('/api/admin/reject-user/:userId', verifyTokenAndApproval, async (req, res) => {
  try {
    // Check if user is admin
    const adminUser = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: { is_admin: true }
    });

    if (!adminUser || !adminUser.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get user to delete their ID photo
    const user = await prisma.users.findUnique({
      where: { id: parseInt(req.params.userId) },
      select: { id_photo_path: true }
    });

    // Delete ID photo file if exists
    if (user?.id_photo_path) {
      const photoPath = path.join(__dirname, '..', user.id_photo_path);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }

    // Delete user using Prisma
    await prisma.users.delete({
      where: { id: parseInt(req.params.userId) }
    });

    res.json({ message: 'User rejected and removed successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to reject user' });
  }
});

// Get user by ID (admin only or self)
app.get('/api/users/:id', verifyTokenAndApproval, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Check if user is requesting their own data or is admin
    const requestingUser = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: { is_admin: true }
    });

    if (req.user.id !== userId && (!requestingUser || !requestingUser.is_admin)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone_number: true,
        date_of_birth: true,
        national_id: true,
        fathers_name: true,
        primary_residence: true,
        relative1_name: true,
        relative1_relation: true,
        relative1_phone: true,
        relative2_name: true,
        relative2_relation: true,
        relative2_phone: true,
        id_photo_path: true,
        approved: true,
        approved_at: true,
        created_at: true,
        updated_at: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user
app.put('/api/users/:id', verifyTokenAndApproval, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { name, phone_number, fathers_name, date_of_birth, primary_residence } = req.body;

    // Check if user is updating their own data
    const requestingUser = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: { is_admin: true }
    });

    if (req.user.id !== userId && (!requestingUser || !requestingUser.is_admin)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validation
    if (!name || !phone_number) {
      return res.status(400).json({ error: 'Name and phone number are required' });
    }

    // Update user using Prisma
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        name,
        phone_number,
        fathers_name: fathers_name || null,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        primary_residence: primary_residence || null
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Change password
app.post('/api/auth/change-password', verifyTokenAndApproval, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get current user
    const user = await prisma.users.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password using Prisma
    await prisma.users.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password updated successfully' });
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
  console.log(`Database: ${process.env.DATABASE_URL}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});