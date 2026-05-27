require('dotenv').config();
const { ensureSchema } = require('./src/config/db');
const app = require('./src/app');

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    console.log('🔌 Connecting to database...');
    console.log('   Host:', process.env.DB_HOST || 'Using DATABASE_URL');
    console.log('   Database:', process.env.DB_NAME || 'From DATABASE_URL');
    
    await ensureSchema();
    
    app.listen(PORT, () => {
      console.log(`🚀  SARMS API running on http://localhost:${PORT}`);
      console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('❌ Failed to initialize database schema:');
    console.error('   Error:', err.message);
    console.error('   Stack:', err.stack);
    process.exit(1);
  }
})();
