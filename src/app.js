const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const estateRoutes = require('./routes/estateRoutes');
const mapRoutes = require('./routes/mapRoutes');
const adminRoutes = require('./routes/adminRoutes');

const customerRoutes = require('./routes/customerRoutes');
const adminCustomerRoutes = require('./routes/adminCustomerRoutes');


// Import middleware
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// CORS configuration
app.use(cors({
  origin: ['http://94.182.92.245', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);

app.use('/api/users', userRoutes);

app.use('/api/customers', customerRoutes);

app.use('/api/estates', estateRoutes);

app.use('/api/maps', mapRoutes);

app.use('/api/admin', adminRoutes);
app.use('/api/admin/customers', adminCustomerRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

// Serve Vue app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

module.exports = app;