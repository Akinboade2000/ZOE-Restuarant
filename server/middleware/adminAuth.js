require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

/**
 * Admin authentication middleware
 * Protects admin-only routes using a shared secret token.
 * 
 * Usage:
 *   router.get('/admin/all', adminAuth, handler)
 * 
 * Client must send header:
 *   x-admin-token: <ADMIN_TOKEN from .env>
 */

module.exports = (req, res, next) => {
  const token = req.headers['x-admin-token'];

  // Reject if no token sent
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: missing admin token' });
  }

  // Reject if ADMIN_TOKEN not configured on server
  if (!process.env.ADMIN_TOKEN) {
    console.error('❌ ADMIN_TOKEN is not set in .env');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  // Compare tokens
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Forbidden: invalid admin token' });
  }

  // Token is valid — continue
  next();
};
