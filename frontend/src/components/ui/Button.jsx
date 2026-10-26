/**
 * Button component supporting primary (forest green), secondary (hairline),
 * danger (burgundy/red), and ghost variants with micro-interactions.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  type = 'button',
  icon = null,
  className = '',
  style = {},
  ...props
}) {
  const variantClass = {
    primary: 'nb-btn--primary',
    secondary: 'nb-btn--secondary',
    danger: 'nb-btn--danger',
    destructive: 'nb-btn--danger',
    ghost: 'nb-btn--ghost',
  }[variant] || 'nb-btn--primary';

  const sizeClass = size === 'sm' ? 'nb-btn--sm' : '';

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`nb-btn ${variantClass} ${sizeClass} ${className}`.trim()}
      style={style}
      {...props}
    >
      {isLoading ? (
        <span
          style={{
            display: 'inline-block',
            width: 14,
            height: 14,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'nbSpin 0.6s linear infinite',
          }}
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
