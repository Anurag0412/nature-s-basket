/**
 * Inventory API service module for Nature's Basket.
 * Communicates with backend/routes/inventoryRoutes.js.
 */
import api from './client';

/**
 * Retrieve inventory details for all products with optional filters.
 * @param {Object} [params]
 * @param {boolean|string} [params.low_stock] - Filter to low stock items (stock <= reorder_level)
 * @param {string} [params.status] - Filter by 'active' | 'inactive'
 * @param {number|string} [params.category_id] - Filter by category ID
 * @returns {Promise<{ success: boolean, count: number, data: Array }>}
 */
export async function getInventory(params = {}) {
  const query = new URLSearchParams();

  if (params.low_stock !== undefined && params.low_stock !== null && params.low_stock !== '') {
    query.set('low_stock', String(params.low_stock));
  }

  if (params.status && params.status !== 'all') {
    query.set('status', params.status);
  }

  if (params.category_id && params.category_id !== 'all') {
    query.set('category_id', String(params.category_id));
  }

  const qs = query.toString();
  const endpoint = qs ? `/api/inventory?${qs}` : '/api/inventory';
  return await api.get(endpoint);
}

/**
 * Retrieve low-stock inventory items directly from backend.
 * @param {Object} [params]
 * @param {string} [params.status] - Filter by 'active' | 'inactive'
 * @returns {Promise<{ success: boolean, count: number, data: Array }>}
 */
export async function getLowStockInventory(params = {}) {
  const query = new URLSearchParams();

  if (params.status && params.status !== 'all') {
    query.set('status', params.status);
  }

  const qs = query.toString();
  const endpoint = qs ? `/api/inventory/low-stock?${qs}` : '/api/inventory/low-stock';
  return await api.get(endpoint);
}

/**
 * Atomically update stock quantity for a product (Staff and Owner only).
 * Uses row-level locking on the backend.
 * @param {number|string} productId
 * @param {number} stockQuantity - Non-negative integer
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function updateStock(productId, stockQuantity) {
  return await api.patch(`/api/inventory/${productId}/stock`, {
    stock_quantity: Number(stockQuantity),
  });
}

export default {
  getInventory,
  getLowStockInventory,
  updateStock,
};
