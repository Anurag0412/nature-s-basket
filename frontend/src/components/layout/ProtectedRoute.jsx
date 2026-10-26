import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { getDefaultRouteForRole } from '../../utils/roleUtils';

/**
 * Route protection wrapper.
 *
 * Enforces:
 * 1. Authentication check (redirects to /login if unauthenticated).
 * 2. Role authorization check (redirects to role default or fallback if not permitted).
 *
 * NOTE: Frontend route protection is strictly a UX safeguard to guide users away
 * from screens they cannot operate. The backend Express API and PostgreSQL transactions
 * remain the sole authoritative security enforcement boundary.
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-parchment)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-wordmark)',
              fontSize: '36px',
              color: 'var(--color-forest)',
              marginBottom: '12px',
            }}
          >
            Nature's Basket
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Verifying secure session...</p>
        </div>
      </div>
    );
  }

  // Not logged in -> send to /login with return location
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role authorization
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const fallback = getDefaultRouteForRole(user.role);
    return <Navigate to={fallback} replace />;
  }

  return children;
}
