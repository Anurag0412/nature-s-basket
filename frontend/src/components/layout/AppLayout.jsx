import TopNavbar from './TopNavbar';

/**
 * Reusable authenticated application shell wrapping the horizontal top navigation
 * and standard container.
 */
export default function AppLayout({ children, maxWidth = 1440, className = '', style = {} }) {
  return (
    <div className="nb-app-shell">
      <TopNavbar />
      <main className={`nb-container ${className}`.trim()} style={{ maxWidth, ...style }}>
        {children}
      </main>
    </div>
  );
}
