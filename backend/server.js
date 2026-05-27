require('dotenv').config();
const { ensureSchema } = require('./src/config/db');
const app = require('./src/app');

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await ensureSchema();
    app.listen(PORT, () => {
      console.log(`🚀  SARMS API running on http://localhost:${PORT}`);
      console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('Failed to initialize database schema:', err.message);
    process.exit(1);
  }
})();
