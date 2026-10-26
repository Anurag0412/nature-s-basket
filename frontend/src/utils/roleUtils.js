/**
 * Helper utilities for role-based navigation and default landings
 */
export const getDefaultRouteForRole = (role) => {
  switch (role) {
    case 'owner':
      return '/dashboard';
    case 'cashier':
      return '/pos';
    case 'staff':
      return '/inventory';
    default:
      return '/login';
  }
};

export default {
  getDefaultRouteForRole,
};
