import MetricCard from './MetricCard';

/**
 * Metric strip container creating 1px solid hairline compartments
 * without nested card bloat.
 */
export default function MetricStrip({ items = [], children = null, className = '', style = {} }) {
  return (
    <section className={`nb-metric-strip ${className}`.trim()} style={style}>
      {children}
      {items.map((item, index) => (
        <MetricCard
          key={item.id || item.label || index}
          label={item.label}
          value={item.value}
          hint={item.hint}
          variant={item.variant}
        />
      ))}
    </section>
  );
}
