import Button from './Button';

/**
 * Standard pagination controls component adhering to the botanical hairline theme.
 */
export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalItems = null,
  pageSize = null,
  onPageChange,
  disabled = false,
  className = '',
  style = {},
}) {
  if (totalPages <= 1 && !totalItems) {
    return null;
  }

  const handlePrev = () => {
    if (currentPage > 1 && onPageChange && !disabled) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages && onPageChange && !disabled) {
      onPageChange(currentPage + 1);
    }
  };

  let summaryText = null;
  if (totalItems !== null && pageSize !== null) {
    const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);
    summaryText = `Showing ${start}–${end} of ${totalItems} entries`;
  } else {
    summaryText = `Page ${currentPage} of ${Math.max(totalPages, 1)}`;
  }

  return (
    <div className={`nb-pagination ${className}`.trim()} style={style}>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{summaryText}</div>

      <div className="nb-pagination-controls">
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePrev}
          disabled={disabled || currentPage <= 1}
          aria-label="Previous page"
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
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Previous
        </Button>

        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            padding: '0 8px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {currentPage} / {Math.max(totalPages, 1)}
        </span>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleNext}
          disabled={disabled || currentPage >= totalPages}
          aria-label="Next page"
        >
          Next
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
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
