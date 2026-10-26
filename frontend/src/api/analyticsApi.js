/**
 * Analytics API service module for Nature's Basket.
 * Communicates strictly with backend/routes/analyticsRoutes.js.
 * All endpoints require valid JWT authentication with the 'owner' role.
 */
import api from './client';

/**
 * Helper to build a clean query string from date parameters.
 * @param {Object} params
 * @param {string} [params.start_date] - YYYY-MM-DD
 * @param {string} [params.end_date] - YYYY-MM-DD
 * @param {number|string} [params.limit]
 * @returns {string}
 */
function buildQueryString(params = {}) {
  const query = new URLSearchParams();
  if (params.start_date) query.set('start_date', params.start_date);
  if (params.end_date) query.set('end_date', params.end_date);
  if (params.limit !== undefined && params.limit !== null) {
    query.set('limit', String(params.limit));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Retrieve high-level executive sales metrics for the date range:
 * - total_revenue
 * - number_of_bills
 * - average_bill_value
 * - total_units_sold
 *
 * @param {Object} [params]
 * @param {string} [params.start_date] - YYYY-MM-DD
 * @param {string} [params.end_date] - YYYY-MM-DD
 * @returns {Promise<{
 *   success: boolean,
 *   date_range: { start_date: string, end_date: string },
 *   data: {
 *     total_revenue: string,
 *     number_of_bills: number,
 *     average_bill_value: string,
 *     total_units_sold: number
 *   }
 * }>}
 */
export async function getOverview(params = {}) {
  return await api.get(`/api/analytics/overview${buildQueryString(params)}`);
}

/**
 * Retrieve chronological daily sales trend data:
 * - date (YYYY-MM-DD)
 * - revenue
 * - number_of_bills
 * - units_sold
 *
 * @param {Object} [params]
 * @param {string} [params.start_date] - YYYY-MM-DD
 * @param {string} [params.end_date] - YYYY-MM-DD
 * @returns {Promise<{
 *   success: boolean,
 *   date_range: { start_date: string, end_date: string },
 *   count: number,
 *   data: Array<{
 *     date: string,
 *     revenue: string,
 *     number_of_bills: number,
 *     units_sold: number
 *   }>
 * }>}
 */
export async function getSalesTrend(params = {}) {
  return await api.get(`/api/analytics/sales-trend${buildQueryString(params)}`);
}

/**
 * Retrieve top-performing products ranked by units sold:
 * - product_id
 * - product_name
 * - units_sold
 * - revenue
 *
 * @param {Object} [params]
 * @param {string} [params.start_date] - YYYY-MM-DD
 * @param {string} [params.end_date] - YYYY-MM-DD
 * @param {number} [params.limit=5]
 * @returns {Promise<{
 *   success: boolean,
 *   date_range: { start_date: string, end_date: string },
 *   count: number,
 *   data: Array<{
 *     product_id: number,
 *     product_name: string,
 *     units_sold: number,
 *     revenue: string
 *   }>
 * }>}
 */
export async function getTopProducts(params = {}) {
  return await api.get(`/api/analytics/top-products${buildQueryString(params)}`);
}

/**
 * Retrieve cashier transaction metrics:
 * - cashier_id
 * - cashier_name
 * - number_of_bills
 * - total_revenue
 * - average_bill_value
 *
 * @param {Object} [params]
 * @param {string} [params.start_date] - YYYY-MM-DD
 * @param {string} [params.end_date] - YYYY-MM-DD
 * @returns {Promise<{
 *   success: boolean,
 *   date_range: { start_date: string, end_date: string },
 *   count: number,
 *   data: Array<{
 *     cashier_id: number,
 *     cashier_name: string,
 *     number_of_bills: number,
 *     total_revenue: string,
 *     average_bill_value: string
 *   }>
 * }>}
 */
export async function getCashierPerformance(params = {}) {
  return await api.get(`/api/analytics/cashier-performance${buildQueryString(params)}`);
}

export default {
  getOverview,
  getSalesTrend,
  getTopProducts,
  getCashierPerformance,
};
