const jwt = require('jsonwebtoken');

/**
 * Verifies the JWT sent in the Authorization header.
 * Attaches decoded payload to req.user on success.
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Access denied – no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired – please log in again' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

module.exports = authenticateToken;
