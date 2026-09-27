/**
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
};
