/**
 * Express middleware that attaches the client IP to the request for audit logging.
 */
function attachIp(req, res, next) {
  const xff = req.headers['x-forwarded-for'];
  const forwardedIp = typeof xff === 'string' ? xff.split(',')[0].trim() : null;
  req.clientIp = forwardedIp || req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress;
  next();
}

module.exports = { attachIp };
