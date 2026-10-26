import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { useAuth } from './context/useAuth';
import { getDefaultRouteForRole } from './utils/roleUtils';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginScreen from './screens/LoginScreen';
import ProductsScreen from './screens/ProductsScreen';
import CategoriesScreen from './screens/CategoriesScreen';
import InventoryScreen from './screens/InventoryScreen';
import PosScreen from './screens/PosScreen';
import SalesHistoryScreen from './screens/SalesHistoryScreen';
import DashboardScreen from './screens/DashboardScreen';

/**
 * Root index redirector based on authentication and role
 */
function RootRedirect() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginScreen />} />

          {/* Root Redirector */}
          <Route path="/" element={<RootRedirect />} />

          {/* Owner Dashboard (Owner Only) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <DashboardScreen />
              </ProtectedRoute>
            }
          />

          {/* Products (All Authenticated: Owner, Staff, Cashier) */}
          <Route
            path="/products"
            element={
              <ProtectedRoute allowedRoles={['owner', 'staff', 'cashier']}>
                <ProductsScreen />
              </ProtectedRoute>
            }
          />

          {/* Categories (All Authenticated: Owner, Staff, Cashier) */}
          <Route
            path="/categories"
            element={
              <ProtectedRoute allowedRoles={['owner', 'staff', 'cashier']}>
                <CategoriesScreen />
              </ProtectedRoute>
            }
          />

          {/* Inventory (All Authenticated: Owner, Staff, Cashier; Restocking Owner & Staff) */}
          <Route
            path="/inventory"
            element={
              <ProtectedRoute allowedRoles={['owner', 'staff', 'cashier']}>
                <InventoryScreen />
              </ProtectedRoute>
            }
          />

          {/* Billing / POS (Strictly Cashier Only) */}
          <Route
            path="/pos"
            element={
              <ProtectedRoute allowedRoles={['cashier']}>
                <PosScreen />
              </ProtectedRoute>
            }
          />

          {/* Sales History (Owner & Cashier; Staff Forbidden) */}
          <Route
            path="/sales"
            element={
              <ProtectedRoute allowedRoles={['owner', 'cashier']}>
                <SalesHistoryScreen />
              </ProtectedRoute>
            }
          />

          {/* Unknown Routes Catch-All */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
