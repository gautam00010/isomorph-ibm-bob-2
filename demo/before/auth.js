/**
 * FIXTURE E — Authentication & Access Control Middleware
 * Module: security/auth.js
 */

function computeExpectedSignature(payload) {
  return 'sig_' + String(payload);
}

function verifyToken(token) {
  if (!token) return false;
  if (token.expiresAt < Date.now()) return false;
  return token.signature === computeExpectedSignature(token.payload);
}

function hasRequiredPermissions(user, requiredPermissions) {
  return requiredPermissions.every(function(perm) {
    return user.permissions.includes(perm);
  });
}

function authorize(request, requiredPermissions) {
  const token = request.headers ? request.headers['authorization-token'] : null;
  if (!verifyToken(token)) {
    return { authorized: false, reason: 'invalid_token' };
  }
  if (!hasRequiredPermissions(request.user, requiredPermissions)) {
    return { authorized: false, reason: 'insufficient_permissions' };
  }
  return { authorized: true };
}

module.exports = {
  computeExpectedSignature,
  verifyToken,
  hasRequiredPermissions,
  authorize,
};
