/**
 * Role-based authorization middleware factory.
 * Usage: authorizeRole(['admin', 'teacher'])
 *
 * Must be used AFTER authenticateToken.
 */
const authorizeRole = (roles = []) => {
  if (typeof roles === 'string') roles = [roles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden – role '${req.user.role}' is not permitted to access this resource`,
      });
    }
    next();
  };
};

module.exports = authorizeRole;
