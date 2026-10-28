/**
 * Currency utility for Nature's Basket.
 * Formats monetary amounts using the Indian Rupee (₹) symbol and Indian numbering system (e.g. ₹1,250.00).
 */

/**
 * Formats a numeric amount or string into Indian Rupee format (e.g., ₹1,250.00).
 * Cleans any existing currency symbols to prevent duplicate symbols.
 * Handles null, undefined, empty string, and NaN values gracefully.
 *
 * @param {number|string} amount - The numeric value or string to format.
 * @returns {string} Formatted string with ₹ symbol and two decimal places.
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || amount === '') {
    return '₹0.00';
  }

  // If already formatted with ₹ or $, strip it first to prevent duplicate symbols
  const cleanValue = typeof amount === 'string' ? amount.replace(/^[₹$]\s*/, '').trim() : amount;
  const num = Number(cleanValue);

  if (isNaN(num)) {
    return '₹0.00';
  }

  const formattedNumber = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  return `₹${formattedNumber}`;
}

export default formatCurrency;
