import Pagination from './Pagination';

/**
 * High-density text-only operational data table.
 * Designed strictly without product photos in management views to maximize scannability.
 */
export default function DataTable({
  columns = [],
  data = [],
  keyField = 'id',
  sortKey = null,
  sortDirection = 'asc',
  onSort = null,
  isLoading = false,
  emptyMessage = 'No records found matching criteria',
  pagination = null,
  onRowClick = null,
  className = '',
  style = {},
}) {
  const handleHeaderClick = (col) => {
    if (col.sortable && onSort) {
      onSort(col.key);
    }
  };

  return (
    <div className={`nb-table-surface ${className}`.trim()} style={style}>
      <table className="nb-data-table">
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = sortKey === col.key;
              const isSortable = Boolean(col.sortable && onSort);
              const textAlign = col.align || 'left';

              return (
                <th
                  key={col.key}
                  onClick={() => handleHeaderClick(col)}
                  className={isSortable ? 'nb-th-sortable' : ''}
                  style={{
                    textAlign,
                    width: col.width,
                    cursor: isSortable ? 'pointer' : 'default',
                  }}
                  aria-sort={
                    isSorted
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: textAlign === 'right' ? 'flex-end' : textAlign === 'center' ? 'center' : 'flex-start',
                      width: '100%',
                      gap: 4,
                    }}
                  >
                    <span>{col.label}</span>
                    {isSortable && (
                      <span className="nb-sort-indicator" aria-hidden="true">
                        {isSorted ? (
                          sortDirection === 'asc' ? '▲' : '▼'
                        ) : (
                          <span style={{ opacity: 0.3 }}>⇅</span>
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  textAlign: 'center',
                  padding: '40px 16px',
                  color: 'var(--text-muted)',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 18,
                      height: 18,
                      border: '2px solid var(--color-forest-tint)',
                      borderTopColor: 'var(--color-forest)',
                      borderRadius: '50%',
                      animation: 'nbSpin 0.6s linear infinite',
                    }}
                  />
                  <span>Loading table records...</span>
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  textAlign: 'center',
                  padding: '36px 16px',
                  color: 'var(--text-muted)',
                  fontSize: '14px',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => {
              const rowKey = row[keyField] ?? rowIndex;
              const isClickable = Boolean(onRowClick);

              return (
                <tr
                  key={rowKey}
                  onClick={isClickable ? () => onRowClick(row) : undefined}
                  style={{ cursor: isClickable ? 'pointer' : 'default' }}
                >
                  {columns.map((col) => {
                    const cellValue = row[col.key];
                    const textAlign = col.align || 'left';

                    return (
                      <td
                        key={col.key}
                        style={{
                          textAlign,
                          width: col.width,
                        }}
                      >
                        {col.render
                          ? col.render(cellValue, row, rowIndex)
                          : (cellValue ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {pagination && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.onPageChange}
          disabled={isLoading || pagination.disabled}
        />
      )}
    </div>
  );
}
