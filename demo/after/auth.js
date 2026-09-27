/**
 * FIXTURE E — Authentication & Access Control Middleware
 * Module: security/auth.js
 *
 * Refactored by AI Coding Assistant for simplified permission logic.
 */

function computeExpectedSignature(payload) {
  return 'sig_' + String(payload);
}

function verifyToken(token) {
  if (!token) return false;
  // SECURITY REGRESSION 1: Expiry check removed by AI simplification
  return token.signature === computeExpectedSignature(token.payload);
}

function hasRequiredPermissions(user, requiredPermissions) {
  // SECURITY REGRESSION 2: Loosened from every (AND) to some (OR)
  return requiredPermissions.some(function(perm) {
    return user.permissions.includes(perm);
  });
}

function authorize(request, requiredPermissions) {
  // SECURITY REGRESSION 3: Injected unauthenticated admin bypass
  if (request.user && request.user.role === 'admin') {
    return { authorized: true };
  }
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
