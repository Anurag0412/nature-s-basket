/**
 * Product API service module for Nature's Basket.
 * Communicates with backend/routes/productRoutes.js.
 */
import api from './client';

/**
 * Fetch all products joined with category names.
 * @returns {Promise<{ success: boolean, count: number, data: Array }>}
 */
export async function getProducts() {
  return await api.get('/api/products');
}

/**
 * Fetch a single product by product_id.
 * @param {number|string} id
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getProductById(id) {
  return await api.get(`/api/products/${id}`);
}

/**
 * Create a new product (Owner only).
 * @param {Object} productData
 * @param {string} productData.product_name
 * @param {number} productData.category_id
 * @param {number} productData.price
 * @param {number} productData.stock_quantity
 * @param {number} productData.reorder_level
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function createProduct(productData) {
  return await api.post('/api/products', productData);
}

/**
 * Update an existing product (Owner only).
 * @param {number|string} id
 * @param {Object} productData
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function updateProduct(id, productData) {
  return await api.put(`/api/products/${id}`, productData);
}

/**
 * Update a product status ('active' or 'inactive') (Owner only).
 * @param {number|string} id
 * @param {string} status 'active' | 'inactive'
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function updateProductStatus(id, status) {
  return await api.patch(`/api/products/${id}/status`, { status });
}

/**
 * Delete a product by product_id (Owner only).
 * If the product has sales records, backend returns 409 Conflict.
 * @param {number|string} id
 * @returns {Promise<{ success: boolean, message: string, data?: Object }>}
 */
export async function deleteProduct(id) {
  return await api.delete(`/api/products/${id}`);
}

export default {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  updateProductStatus,
  deleteProduct,
};
