const app = require('./app');
const PORT = process.env.PORT || 3000;

// Create upload directories if they don't exist
const fs = require('fs');
const path = require('path');

const createUploadDirs = () => {
  const uploadsDir = path.join(__dirname, '../uploads');
  const idPhotosDir = path.join(uploadsDir, 'id-photos');
  const mapsDir = path.join(uploadsDir, 'maps');

  [uploadsDir, idPhotosDir, mapsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  console.log('✅ Upload directories ready');
};

// Start server
app.listen(PORT, () => {
  createUploadDirs();
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📚 API available at http://localhost:${PORT}/api`);
  console.log(`🗄️  Database: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
});