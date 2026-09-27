/**
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
};
