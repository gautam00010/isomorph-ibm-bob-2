/**
 * ISOMORPH Canonical Demo Fixtures & Scenarios
 *
 * Provides deterministic fixtures for the three canonical demo scenarios:
 * 01: Refactor Noise (Primary demo — large diff, 1 critical logic mutation)
 * 02: Tiny Logic Mutation (Proof that diff size != risk; 3 lines changed, HIGH risk)
 * 03: Authentication Risk (Demonstrates complete verification loop)
 */

export interface DemoScenario {
  id: 'refactor_noise' | 'tiny_mutation' | 'auth_risk';
  num: '01' | '02' | '03';
  label: string;
  badge: string;
  name: string;
  modulePath: string;
  question: string;
  summary: string;
  stats: {
    lines: string;
    nodes: string;
    signal: string;
  };
  beforeCode: string;
  afterCode: string;
  defaultEntryId: string;
  animLines: Array<{ text: string; type: 'noise' | 'highlight-crit' | 'highlight-med' }>;
  animCallout: {
    tag: string;
    desc: string;
  };
  textualLinesAdded: number;
  textualLinesRemoved: number;
}

// ============================================================================
// Scenario 01: Refactor Noise (Flagship Golden Corpus)
// ============================================================================

export const SCENARIO_01_BEFORE = `/**
 * Enterprise Discount & Pricing Calculation Engine
 * Version: 2.4.1
 * Module: pricing/discount.js
 */

const VALID_TIERS = ['STANDARD', 'SILVER', 'GOLD', 'PLATINUM'];

const TIER_RATES = {
  STANDARD: 0.0,
  SILVER: 0.05,
  GOLD: 0.10,
  PLATINUM: 0.15,
};

/**
 * Validates discount rate is within valid 0.0 to 1.0 range.
 */
function isValidRate(rate) {
  return typeof rate === 'number' && rate >= 0 && rate <= 1.0;
}

/**
 * Validates order item structure and values.
 */
function validateOrderItem(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }
  if (typeof item.id !== 'string' || item.id.length === 0) {
    return false;
  }
  if (typeof item.price !== 'number' || isNaN(item.price)) {
    return false;
  }
  if (typeof item.quantity !== 'number' || item.quantity < 1) {
    return false;
  }
  return true;
}

/**
 * Calculates line-item discount with zero/negative price guard.
 * If price is zero or negative, discount must be 0 to prevent negative billing.
 */
function calculateDiscount(price, rate) {
  if (!isValidRate(rate)) {
    throw new Error('Invalid discount rate: must be between 0.0 and 1.0');
  }
  return price > 0 ? price * (1 - rate) : 0;
}

/**
 * Determines percentage discount based on user loyalty tier.
 */
function calculateTierDiscount(tier, baseAmount) {
  if (!VALID_TIERS.includes(tier)) {
    return baseAmount;
  }
  const discountRate = TIER_RATES[tier];
  return baseAmount * (1 - discountRate);
}

/**
 * Calculates volume-based discount for bulk orders.
 */
function calculateVolumeDiscount(quantity, unitPrice) {
  const subtotal = quantity * unitPrice;
  if (quantity >= 100) {
    return subtotal * 0.80; // 20% off for 100+
  } else if (quantity >= 50) {
    return subtotal * 0.90; // 10% off for 50+
  } else if (quantity >= 20) {
    return subtotal * 0.95; // 5% off for 20+
  }
  return subtotal;
}

/**
 * Computes applicable promotional code adjustment.
 */
function applyPromoCode(code, currentTotal) {
  if (!code || typeof code !== 'string') {
    return currentTotal;
  }
  const cleanCode = code.trim().toUpperCase();
  if (cleanCode === 'SAVE10') {
    return Math.max(0, currentTotal - 10);
  }
  if (cleanCode === 'HALFPRICE') {
    return currentTotal * 0.5;
  }
  return currentTotal;
}

/**
 * Helper to compute tax on a discounted amount.
 */
function computeSalesTax(amount, stateTaxRate) {
  if (amount <= 0) return 0;
  return amount * stateTaxRate;
}

/**
 * Main pricing orchestrator for an order.
 */
function processOrderPricing(order) {
  if (!order || !Array.isArray(order.items)) {
    throw new Error('Invalid order object');
  }

  let rawSubtotal = 0;
  let discountedSubtotal = 0;

  for (const item of order.items) {
    if (!validateOrderItem(item)) {
      throw new Error('Invalid order item detected in basket');
    }

    const itemPrice = item.price;
    const itemRate = item.customDiscountRate ?? 0;
    const finalItemPrice = calculateDiscount(itemPrice, itemRate);

    rawSubtotal += itemPrice * item.quantity;
    discountedSubtotal += finalItemPrice * item.quantity;
  }

  const tier = order.customerTier || 'STANDARD';
  const afterTier = calculateTierDiscount(tier, discountedSubtotal);
  const afterPromo = applyPromoCode(order.promoCode, afterTier);
  const taxRate = order.taxRate ?? 0.08;
  const tax = computeSalesTax(afterPromo, taxRate);
  const finalTotal = afterPromo + tax;

  return {
    rawSubtotal,
    discountedSubtotal,
    savings: Math.max(0, rawSubtotal - discountedSubtotal),
    tax,
    finalTotal: Math.round(finalTotal * 100) / 100,
  };
}

module.exports = {
  VALID_TIERS,
  TIER_RATES,
  isValidRate,
  validateOrderItem,
  calculateDiscount,
  calculateTierDiscount,
  calculateVolumeDiscount,
  applyPromoCode,
  computeSalesTax,
  processOrderPricing,
};`;

export const SCENARIO_01_AFTER = `/**
 * Enterprise Discount & Pricing Calculation Engine
 * Version: 2.5.0-refactored
 * Module: pricing/discount.js
 *
 * Refactored by AI Coding Assistant for clarity and conciseness.
 */

const VALID_TIERS = ['STANDARD', 'SILVER', 'GOLD', 'PLATINUM'];

const TIER_RATES = {
  STANDARD: 0.0,
  SILVER: 0.05,
  GOLD: 0.10,
  PLATINUM: 0.15,
};

/**
 * Validates discount rate is within valid 0.0 to 1.0 range.
 */
function isValidRate(rate) {
  return typeof rate === 'number' && rate >= 0 && rate <= 1.0;
}

/**
 * Validates order item structure and values.
 */
function validateOrderItem(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }
  if (typeof item.id !== 'string' || item.id.length === 0) {
    return false;
  }
  if (typeof item.price !== 'number' || isNaN(item.price)) {
    return false;
  }
  if (typeof item.quantity !== 'number' || item.quantity < 1) {
    return false;
  }
  return true;
}

/**
 * Calculates line-item discount.
 * Optimized expression for streamlined return.
 */
function calculateDiscount(price, rate) {
  if (!isValidRate(rate)) {
    throw new Error('Invalid discount rate: must be between 0.0 and 1.0');
  }
  // Simplified calculation without redundant ternary condition
  return price * (1 - rate);
}

/**
 * Determines percentage discount based on user loyalty tier.
 */
function calculateTierDiscount(tier, baseAmount) {
  if (!VALID_TIERS.includes(tier)) {
    return baseAmount;
  }
  const tierRate = TIER_RATES[tier];
  return baseAmount * (1 - tierRate);
}

/**
 * Calculates volume-based discount for bulk orders.
 */
function calculateVolumeDiscount(quantity, unitPrice) {
  const subtotal = quantity * unitPrice;
  if (quantity >= 100) {
    return subtotal * 0.80; // 20% tier
  } else if (quantity >= 50) {
    return subtotal * 0.90; // 10% tier
  } else if (quantity >= 20) {
    return subtotal * 0.95; // 5% tier
  }
  return subtotal;
}

/**
 * Helper to compute tax on a discounted amount.
 */
function computeSalesTax(amount, stateTaxRate) {
  if (amount <= 0) return 0;
  return amount * stateTaxRate;
}

/**
 * Computes applicable promotional code adjustment.
 */
function applyPromoCode(code, currentTotal) {
  if (!code || typeof code !== 'string') {
    return currentTotal;
  }
  const normalizedCode = code.trim().toUpperCase();
  if (normalizedCode === 'SAVE10') {
    return Math.max(0, currentTotal - 10);
  }
  if (normalizedCode === 'HALFPRICE') {
    return currentTotal * 0.5;
  }
  return currentTotal;
}

/**
 * Main pricing orchestrator for an order.
 */
function processOrderPricing(order) {
  if (!order || !Array.isArray(order.items)) {
    throw new Error('Invalid order object');
  }

  let rawSubtotal = 0;
  let discountedSubtotal = 0;

  for (const item of order.items) {
    if (!validateOrderItem(item)) {
      throw new Error('Invalid order item detected in basket');
    }

    const unitPrice = item.price;
    const itemRate = item.customDiscountRate ?? 0;
    const adjustedItemPrice = calculateDiscount(unitPrice, itemRate);

    rawSubtotal += unitPrice * item.quantity;
    discountedSubtotal += adjustedItemPrice * item.quantity;
  }

  const tier = order.customerTier || 'STANDARD';
  const afterTier = calculateTierDiscount(tier, discountedSubtotal);
  const discountedAmount = applyPromoCode(order.promoCode, afterTier);
  const taxRate = order.taxRate ?? 0.08;
  const tax = computeSalesTax(discountedAmount, taxRate);
  const finalTotal = discountedAmount + tax;

  return {
    rawSubtotal,
    discountedSubtotal,
    savings: Math.max(0, rawSubtotal - discountedSubtotal),
    tax,
    finalTotal: Math.round(finalTotal * 100) / 100,
  };
}

module.exports = {
  VALID_TIERS,
  TIER_RATES,
  isValidRate,
  validateOrderItem,
  calculateDiscount,
  calculateTierDiscount,
  calculateVolumeDiscount,
  applyPromoCode,
  computeSalesTax,
  processOrderPricing,
};`;

// Backward compatibility exports
export const DEMO_BEFORE_CODE = SCENARIO_01_BEFORE;
export const DEMO_AFTER_CODE = SCENARIO_01_AFTER;

// ============================================================================
// Scenario 02: Tiny Logic Mutation (Bounds Check & Off-by-One Defect)
// ============================================================================

export const SCENARIO_02_BEFORE = `/**
 * FIXTURE B — Page Index & Bounds Guard
 * Module: pagination/bounds.js
 */

function isValidPageIndex(index, totalPages) {
  if (index === null || index === undefined) {
    return false;
  }
  if (index < 0 || index >= totalPages) {
    return false;
  }
  return true;
}

function getPage(index, totalPages, pages) {
  if (!isValidPageIndex(index, totalPages)) {
    throw new Error('Invalid page index: ' + index);
  }
  return pages[index];
}

function processRequest(userInput, pages) {
  const index = parseInt(userInput, 10);
  const page = getPage(index, pages.length, pages);
  return page.content;
}

module.exports = {
  isValidPageIndex,
  getPage,
  processRequest,
};`;

export const SCENARIO_02_AFTER = `/**
 * FIXTURE B — Page Index & Bounds Guard
 * Module: pagination/bounds.js
 *
 * Refactored by AI Coding Assistant for conciseness.
 */

function isValidPageIndex(index, totalPages) {
  if (index == null) {
    return false;
  }
  // Off-by-one regression: index === totalPages now accepted as valid
  if (index < 0 || index > totalPages) {
    return false;
  }
  return true;
}

function getPage(index, totalPages, pages) {
  if (!isValidPageIndex(index, totalPages)) {
    throw new Error('Invalid page index: ' + index);
  }
  return pages[index];
}

function processRequest(userInput, pages) {
  const index = parseInt(userInput, 10);
  const page = getPage(index, pages.length, pages);
  return page.content;
}

module.exports = {
  isValidPageIndex,
  getPage,
  processRequest,
};`;

// ============================================================================
// Scenario 03: Authentication Risk (Complete Verification Loop)
// ============================================================================

export const SCENARIO_03_BEFORE = `/**
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
};`;

export const SCENARIO_03_AFTER = `/**
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
};`;

// ============================================================================
// Scenarios Registry
// ============================================================================

export const DEMO_SCENARIOS: Record<string, DemoScenario> = {
  refactor_noise: {
    id: 'refactor_noise',
    num: '01',
    label: 'Refactor Noise',
    badge: 'Primary Golden Demo',
    name: 'E-Commerce Pricing Engine',
    modulePath: 'pricing/discount.js',
    question: 'An AI changed 842 lines of code. What actually changed?',
    summary:
      'An AI assistant refactored 842 lines for "clarity and conciseness". 96% of changes are cosmetic formatting and variable renames, but deterministic structural forensics isolates a removed non-positive price check in calculateDiscount.',
    stats: {
      lines: '842 lines noise',
      nodes: '302 nodes',
      signal: '1 Subtle negative price regression',
    },
    beforeCode: SCENARIO_01_BEFORE,
    afterCode: SCENARIO_01_AFTER,
    defaultEntryId: 'calculateDiscount',
    animLines: [
      { text: '- function calculateDiscount(price, rate) {', type: 'noise' },
      { text: '- // Ensure valid customer rates', type: 'noise' },
      { text: '- return price > 0 ? price * (1 - rate) : 0;', type: 'highlight-crit' },
      { text: '+ return price * (1 - rate);', type: 'highlight-crit' },
      { text: '+ // Simplified calculation without redundant ternary condition', type: 'noise' },
      { text: '- const discountRate = TIER_RATES[tier];', type: 'noise' },
      { text: '+ const tierRate = TIER_RATES[tier];', type: 'highlight-med' },
      { text: '+ return baseAmount * (1 - tierRate);', type: 'noise' },
      { text: '- return subtotal * 0.80; // 20% off for 100+', type: 'noise' },
      { text: '+ return subtotal * 0.80; // 20% tier', type: 'noise' },
    ],
    animCallout: {
      tag: 'STRUCTURAL FORENSICS COMPLETE',
      desc: '842 lines of textual noise collapsed • 3 behavior-sensitive regions isolated deterministically',
    },
    textualLinesAdded: 482,
    textualLinesRemoved: 360,
  },

  tiny_mutation: {
    id: 'tiny_mutation',
    num: '02',
    label: 'Tiny Logic Mutation',
    badge: '3-Line Diff Proof',
    name: 'Pagination Bounds Guard',
    modulePath: 'pagination/bounds.js',
    question: 'An AI changed only 3 lines of code. Is it safe to merge?',
    summary:
      'Proof that Isomorph does NOT equate diff size with risk. An AI simplified a 3-line boundary condition. Naive review would approve the tiny diff; Isomorph flags a critical off-by-one out-of-bounds array access.',
    stats: {
      lines: '+3 / -3',
      nodes: '38 nodes',
      signal: '1 Critical off-by-one boundary flaw',
    },
    beforeCode: SCENARIO_02_BEFORE,
    afterCode: SCENARIO_02_AFTER,
    defaultEntryId: 'isValidPageIndex',
    animLines: [
      { text: 'function isValidPageIndex(index, totalPages) {', type: 'noise' },
      { text: '- if (index === null || index === undefined) return false;', type: 'highlight-med' },
      { text: '+ if (index == null) return false;', type: 'highlight-med' },
      { text: '- if (index < 0 || index >= totalPages) return false;', type: 'highlight-crit' },
      { text: '+ if (index < 0 || index > totalPages) return false;', type: 'highlight-crit' },
      { text: '  return true;', type: 'noise' },
      { text: '}', type: 'noise' },
      { text: 'function getPage(index, totalPages, pages) {', type: 'noise' },
      { text: '  return pages[index]; // Out of bounds when index === totalPages', type: 'highlight-crit' },
      { text: '}', type: 'noise' },
    ],
    animCallout: {
      tag: 'DIFF SIZE ≠ RISK LEVEL',
      desc: 'Small 3-line diff contains critical off-by-one boundary vulnerability (>= to >)',
    },
    textualLinesAdded: 3,
    textualLinesRemoved: 3,
  },

  auth_risk: {
    id: 'auth_risk',
    num: '03',
    label: 'Authentication Risk',
    badge: 'Complete Verification Loop',
    name: 'Security & Access Middleware',
    modulePath: 'security/auth.js',
    question: 'An AI simplified security middleware. What broke?',
    summary:
      'Demonstrates the complete verification loop: CST isolation catches removed token expiry, permission downgrade (AND to OR), and admin bypass; Bob explains exploit vector; subprocess tests fail with reproducible evidence.',
    stats: {
      lines: '+12 / -10',
      nodes: '46 nodes',
      signal: '3 Critical security vulnerabilities',
    },
    beforeCode: SCENARIO_03_BEFORE,
    afterCode: SCENARIO_03_AFTER,
    defaultEntryId: 'verifyToken',
    animLines: [
      { text: 'function verifyToken(token) {', type: 'noise' },
      { text: '- if (token.expiresAt < Date.now()) return false;', type: 'highlight-crit' },
      { text: '+ // Expiry check omitted by AI simplification', type: 'noise' },
      { text: 'function hasRequiredPermissions(user, requiredPermissions) {', type: 'noise' },
      { text: '- return requiredPermissions.every(perm => user.permissions.includes(perm));', type: 'highlight-crit' },
      { text: '+ return requiredPermissions.some(perm => user.permissions.includes(perm));', type: 'highlight-crit' },
      { text: 'function authorize(request, requiredPermissions) {', type: 'noise' },
      { text: '+ if (request.user && request.user.role === "admin") return { authorized: true };', type: 'highlight-crit' },
      { text: '  if (!verifyToken(token)) return { authorized: false };', type: 'noise' },
    ],
    animCallout: {
      tag: 'COMPLETE VERIFICATION LOOP',
      desc: '3 security regressions isolated • Bob reasoning mapped • Executed test assertions failed',
    },
    textualLinesAdded: 12,
    textualLinesRemoved: 10,
  },
};

/**
 * Deterministic patched version of Scenario 01 for the FAIL -> FIX -> PASS demo sequence.
 * Restores the zero/negative price guard: return price > 0 ? price * (1 - rate) : 0;
 */
export const SCENARIO_01_FIXED = SCENARIO_01_AFTER.replace(
  '  // Simplified calculation without redundant ternary condition\n  return price * (1 - rate);',
  '  // Restored negative-price guard: prevents negative billing\n  return price > 0 ? price * (1 - rate) : 0;'
);
