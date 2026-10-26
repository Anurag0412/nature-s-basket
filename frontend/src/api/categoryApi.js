/**
 * Category API service module for Nature's Basket.
 * Communicates with backend/routes/categoryRoutes.js.
 */
import api from './client';

/**
 * Fetch all categories.
 * @returns {Promise<{ success: boolean, count: number, data: Array }>}
 */
export async function getCategories() {
  return await api.get('/api/categories');
}

/**
 * Fetch a single category by category_id.
 * @param {number|string} id
 * @returns {Promise<{ success: boolean, data: Object }>}
 */
export async function getCategoryById(id) {
  return await api.get(`/api/categories/${id}`);
}

/**
 * Create a new category (Owner only).
 * @param {Object} categoryData
 * @param {string} categoryData.category_name
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function createCategory(categoryData) {
  return await api.post('/api/categories', categoryData);
}

/**
 * Update an existing category name (Owner only).
 * @param {number|string} id
 * @param {Object} categoryData
 * @param {string} categoryData.category_name
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function updateCategory(id, categoryData) {
  return await api.put(`/api/categories/${id}`, categoryData);
}

/**
 * Update category status ('active' or 'inactive') (Owner only).
 * @param {number|string} id
 * @param {string} status 'active' | 'inactive'
 * @returns {Promise<{ success: boolean, message: string, data: Object }>}
 */
export async function updateCategoryStatus(id, status) {
  return await api.patch(`/api/categories/${id}/status`, { status });
}

export default {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  updateCategoryStatus,
};
