import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getDefaultRouteForRole } from '../utils/roleUtils';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import FormField from '../components/ui/FormField';

export default function LoginScreen() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // If already logged in, redirect away from login page immediately
  if (isAuthenticated && user) {
    const target = location.state?.from?.pathname || getDefaultRouteForRole(user.role);
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim() || !password.trim()) {
      setErrorMessage('Username and password are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login({ username: username.trim(), password });
      const target = location.state?.from?.pathname || getDefaultRouteForRole(res.user.role);
      navigate(target, { replace: true });
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-3)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--bg-surface)',
          border: 'var(--border-hairline)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-4)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
          <div
            style={{
              fontFamily: 'var(--font-wordmark)',
              fontSize: '38px',
              color: 'var(--color-forest)',
              lineHeight: 1.1,
              letterSpacing: '0.02em',
            }}
          >
            Nature's Basket
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Grocery Store Management System
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--color-danger-tint)',
              color: 'var(--color-danger)',
              border: '1px solid rgba(185, 28, 28, 0.25)',
              borderRadius: 'var(--radius-sharp)',
              fontSize: '13px',
              marginBottom: 'var(--space-2)',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <FormField label="Username" htmlFor="login-username" required>
            <Input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. owner.admin"
              autoComplete="username"
              disabled={isSubmitting}
              autoFocus
            />
          </FormField>

          <FormField label="Password" htmlFor="login-password" required>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isSubmitting}
            />
          </FormField>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <Button
              id="login-submit-btn"
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              style={{ width: '100%', padding: '11px 16px', fontSize: '14.5px' }}
            >
              Sign In to Store
            </Button>
          </div>
        </form>

        <div
          style={{
            marginTop: 'var(--space-3)',
            paddingTop: 'var(--space-2)',
            borderTop: 'var(--border-hairline)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          Protected by PostgreSQL Role-Based Authorization
        </div>
      </div>
    </div>
  );
}
