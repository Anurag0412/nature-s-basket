import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

/**
 * Computes up to 2 uppercase initials from a user's name or username.
 */
function getInitials(name, username) {
  const target = (name || username || '').trim();
  if (!target) return 'NB';
  const parts = target.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return target.substring(0, 2).toUpperCase();
}

/**
 * Top navigation bar with script wordmark, role-scoped links, active indicator,
 * user initials avatar, role indicator, functional logout, and responsive mobile drawer.
 */
export default function TopNavbar() {
  const { user, logout, isOwner, isStaff, isCashier } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Determine navigation items visible to the current role
  const navItems = [];

  if (isOwner) {
    navItems.push(
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/products', label: 'Products' },
      { to: '/categories', label: 'Categories' },
      { to: '/inventory', label: 'Inventory' },
      { to: '/sales', label: 'Sales History' }
    );
  } else if (isCashier) {
    navItems.push(
      { to: '/pos', label: 'Billing (POS)' },
      { to: '/products', label: 'Products' },
      { to: '/categories', label: 'Categories' },
      { to: '/inventory', label: 'Inventory' },
      { to: '/sales', label: 'My Sales' }
    );
  } else if (isStaff) {
    navItems.push(
      { to: '/inventory', label: 'Inventory' },
      { to: '/products', label: 'Products' },
      { to: '/categories', label: 'Categories' }
    );
  }

  const roleClass =
    user?.role === 'owner'
      ? 'nb-role-tag'
      : user?.role === 'cashier'
      ? 'nb-role-tag nb-role-tag--cashier'
      : 'nb-role-tag nb-role-tag--staff';

  const initials = getInitials(user?.name, user?.username);

  return (
    <header className="nb-top-header">
      <div className="nb-brand-group">
        <NavLink to="/" className="nb-wordmark" id="brand-wordmark">
          Nature's Basket
        </NavLink>
        <nav aria-label="Main Navigation" className="nb-nav-desktop">
          <ul className="nb-nav-links">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `nb-nav-item ${isActive ? 'active' : ''}`}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Desktop Controls */}
      <div className="nb-header-controls nb-header-controls-desktop">
        {user && (
          <div className="nb-user-pill">
            <span className="nb-avatar" title={user.name || user.username}>
              {initials}
            </span>
            <span style={{ fontWeight: 600 }}>{user.name || user.username}</span>
            <span className={roleClass}>{user.role}</span>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="nb-btn nb-btn--ghost nb-btn--sm"
          id="logout-button"
          title="Sign out of system"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>

      {/* Mobile Hamburger Button */}
      <button
        type="button"
        className="nb-hamburger-btn"
        onClick={() => setMobileMenuOpen((prev) => !prev)}
        aria-label="Toggle navigation menu"
        aria-expanded={mobileMenuOpen}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {mobileMenuOpen ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {/* Mobile Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="nb-mobile-drawer">
          {user && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderBottom: 'var(--border-hairline)',
                marginBottom: 6,
              }}
            >
              <span className="nb-avatar">{initials}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{user.name || user.username}</span>
                <span className={roleClass} style={{ alignSelf: 'flex-start', marginTop: 2 }}>
                  {user.role}
                </span>
              </div>
            </div>
          )}

          <nav aria-label="Mobile Navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `nb-mobile-nav-link ${isActive ? 'active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div style={{ marginTop: 8, paddingTop: 8, borderTop: 'var(--border-hairline)' }}>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="nb-btn nb-btn--ghost nb-btn--sm"
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
