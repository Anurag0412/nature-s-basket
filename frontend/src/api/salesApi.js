/**
 * Sales & POS API service module for Nature's Basket.
 * Communicates with backend/routes/salesRoutes.js.
 */
import api from './client';

/**
 * Create a new bill / sale transaction (Strictly Cashier role).
 * Recalculates totals server-side and atomically decrements inventory with row-locks.
 * @param {Object} saleData
 * @param {Array<{ product_id: number, quantity: number }>} saleData.items
 * @returns {Promise<{
 *   success: boolean,
 *   message: string,
 *   data: {
 *     sale_id: number,
 *     cashier_id: number,
 *     cashier_name: string,
 *     sale_date: string,
 *     total_amount: string,
 *     items: Array<{
 *       sale_item_id: number,
 *       product_id: number,
 *       product_name: string,
 *       quantity: number,
 *       unit_price: string,
 *       subtotal: string
 *     }>
 *   }
 * }>}
 */
export async function createSale(saleData) {
  return await api.post('/api/sales', saleData);
}

/**
 * Retrieve sale transaction details by ID.
 * Access: Owner (any sale), Cashier (own sales only), Staff (forbidden).
 * @param {number|string} id
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getSaleById(id) {
  return await api.get(`/api/sales/${id}`);
}

/**
 * Retrieve paginated sales list.
 * Access: Owner (all sales), Cashier (own sales only), Staff (forbidden).
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 * @returns {Promise<{ success: boolean, pagination: Object, data: Array }>}
 */
export async function getAllSales(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const endpoint = qs ? `/api/sales?${qs}` : '/api/sales';
  return await api.get(endpoint);
}

export default {
  createSale,
  getSaleById,
  getAllSales,
};
