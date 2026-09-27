/**
 * FIXTURE E — AFTER (authentication/authorization change)
 *
 * What changed (textually): ~10 lines changed
 * What changed (structurally): MULTIPLE HIGH risk changes
 *
 * SECURITY BUGS INTRODUCED:
 *
 * BUG 1 (line ~17): Token expiry check REMOVED from verifyToken.
 *   Before: `if (token.expiresAt < Date.now()) return false;`
 *   After:  This check is gone. Expired tokens are now accepted.
 *
 * BUG 2 (line ~26): Permission check changed from AND (every) to OR (some).
 *   Before: `requiredPermissions.every(...)` — user must have ALL required permissions
 *   After:  `requiredPermissions.some(...)` — user needs only ONE permission
 *
 * BUG 3 (line ~31): Admin bypass introduced.
 *   If user has 'admin' role, authorization is skipped entirely.
 *   This was not in the original code.
 *
 * A text diff shows moderate changes. The structural differ must flag all three as HIGH.
 */

function verifyToken(token) {
  if (!token) return false;
  return token.signature === computeExpectedSignature(token.payload);
}

function hasRequiredPermissions(user, requiredPermissions) {
  return requiredPermissions.some(function(perm) {
    return user.permissions.includes(perm);
  });
}

function authorize(request, requiredPermissions) {
  if (request.user && request.user.role === 'admin') {
    return { authorized: true };
  }
  const token = request.headers['authorization-token'];
  if (!verifyToken(token)) {
    return { authorized: false, reason: 'invalid_token' };
  }
  if (!hasRequiredPermissions(request.user, requiredPermissions)) {
    return { authorized: false, reason: 'insufficient_permissions' };
  }
  return { authorized: true };
}
