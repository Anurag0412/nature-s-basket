import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import PageHeader from '../components/layout/PageHeader';
import MetricStrip from '../components/ui/MetricStrip';
import MetricCard from '../components/ui/MetricCard';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import FormField from '../components/ui/FormField';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { getAllSales, getSaleById } from '../api/salesApi';

/**
 * Sales History & Receipts Screen
 *
 * Operational transaction ledger with role-scoped isolation:
 * - Owner: views all sales across all store cashiers with aggregate metrics.
 * - Cashier: strictly views their own sales transactions.
 * - Staff: forbidden by ProtectedRoute and backend RBAC.
 *
 * Features:
 * - Live transaction retrieval via `GET /api/sales` with pagination.
 * - Itemized receipt inspection via `GET /api/sales/:id` with complete line items.
 * - Print-ready receipt presentation matching Nature's Basket botanical aesthetics.
 */
export default function SalesHistoryScreen() {
  const { user, isOwner, isCashier } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Ledger state
  const [sales, setSales] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Client-side quick filter & sort on current page
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('sale_id');
  const [sortDir, setSortDir] = useState('desc');

  // Receipt modal state
  const [selectedSaleSummary, setSelectedSaleSummary] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [isReceiptLoading, setIsReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState(null);

  // Load sales ledger from backend API
  const loadSales = useCallback(
    async (pageToLoad = 1) => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const res = await getAllSales({ page: pageToLoad, limit: 10 });
        if (res && res.success) {
          setSales(res.data || []);
          if (res.pagination) {
            setPagination(res.pagination);
            setCurrentPage(res.pagination.page);
          } else {
            setPagination({
              page: pageToLoad,
              limit: 10,
              total: res.data ? res.data.length : 0,
              totalPages: 1,
            });
            setCurrentPage(pageToLoad);
          }
        } else {
          throw new Error(res.message || 'Failed to retrieve sales transactions');
        }
      } catch (err) {
        console.error('Error fetching sales:', err);
        setFetchError(err.message || 'Unable to connect to sales service');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let ignore = false;
    getAllSales({ page: 1, limit: 10 })
      .then((res) => {
        if (!ignore && res && res.success) {
          setSales(res.data || []);
          if (res.pagination) {
            setPagination(res.pagination);
            setCurrentPage(res.pagination.page);
          } else {
            setPagination({
              page: 1,
              limit: 10,
              total: res.data ? res.data.length : 0,
              totalPages: 1,
            });
            setCurrentPage(1);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error('Error fetching sales:', err);
          setFetchError(err.message || 'Unable to connect to sales service');
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Handle page navigation
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== currentPage) {
      loadSales(newPage);
    }
  };

  // Open receipt modal and fetch itemized sale details
  const handleViewReceipt = async (sale) => {
    setSelectedSaleSummary(sale);
    setReceiptModalOpen(true);
    setReceiptData(null);
    setReceiptError(null);
    setIsReceiptLoading(true);

    try {
      const res = await getSaleById(sale.sale_id);
      if (res && res.success && res.data) {
        setReceiptData(res.data);
      } else {
        throw new Error(res.message || 'Receipt details could not be retrieved.');
      }
    } catch (err) {
      console.error('Failed to load receipt details:', err);
      setReceiptError(err.message || 'Failed to load itemized receipt details.');
    } finally {
      setIsReceiptLoading(false);
    }
  };

  // Sort handler
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Filter current page items by search query
  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return sales;
    const query = searchQuery.trim().toLowerCase();
    return sales.filter((s) => {
      const idMatch = String(s.sale_id).includes(query);
      const cashierMatch = (s.cashier_name || '').toLowerCase().includes(query);
      const usernameMatch = (s.cashier_username || '').toLowerCase().includes(query);
      const amountMatch = String(s.total_amount || '').includes(query);
      return idMatch || cashierMatch || usernameMatch || amountMatch;
    });
  }, [sales, searchQuery]);

  // Sorted items
  const sortedSales = useMemo(() => {
    return [...filteredSales].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (sortKey === 'sale_id' || sortKey === 'total_amount') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else if (sortKey === 'sale_date') {
        aVal = new Date(aVal).getTime() || 0;
        bVal = new Date(bVal).getTime() || 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredSales, sortKey, sortDir]);

  // Aggregate metrics calculation
  const metrics = useMemo(() => {
    const totalTransactions = pagination.total || 0;
    const pageRevenue = sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
    return {
      totalTransactions,
      pageRevenue: pageRevenue.toFixed(2),
    };
  }, [pagination.total, sales]);

  // Table columns definition
  const columns = [
    {
      key: 'sale_id',
      label: 'Receipt #',
      width: '120px',
      sortable: true,
      render: (val) => (
        <span
          style={{
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--color-forest)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          #{String(val).padStart(5, '0')}
        </span>
      ),
    },
    {
      key: 'sale_date',
      label: 'Date & Time',
      sortable: true,
      render: (val) => {
        if (!val) return '—';
        const d = new Date(val);
        return (
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
              {d.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        );
      },
    },
    {
      key: 'cashier_name',
      label: 'Cashier / Operator',
      sortable: true,
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
            {val || 'Unknown Cashier'}
          </div>
          {row.cashier_username && (
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              @{row.cashier_username}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'total_amount',
      label: 'Total Amount',
      align: 'right',
      width: '150px',
      sortable: true,
      render: (val) => (
        <span
          style={{
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            fontSize: '14.5px',
            color: 'var(--color-forest)',
          }}
        >
          ${Number(val || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      width: '140px',
      render: (_, row) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleViewReceipt(row)}
          title={`View receipt #${row.sale_id}`}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginRight: 5 }}
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          View Receipt
        </Button>
      ),
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title={isOwner ? 'Sales History & Audit Ledger' : 'My Sales Register'}
        subtitle={
          isOwner
            ? 'Complete audit ledger of historical customer sales across all active store cashiers'
            : 'Personal transaction journal of bills processed under your cashier credentials'
        }
        badge={
          <Badge variant="active">
            {isOwner ? 'All Store Cashiers' : `Cashier: ${user?.name || user?.username}`}
          </Badge>
        }
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
            {isCashier && (
              <Button variant="primary" size="sm" onClick={() => navigate('/pos')}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: 5 }}
                  aria-hidden="true"
                >
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                Open POS Register
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                loadSales(currentPage);
                toast.info('Sales ledger refreshed');
              }}
              disabled={isLoading}
              title="Refresh ledger records"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: 5 }}
                aria-hidden="true"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Refresh
            </Button>
          </div>
        }
      />

      {/* Metric Strip */}
      <MetricStrip>
        <MetricCard
          label={isOwner ? 'Total Store Transactions' : 'My Recorded Transactions'}
          value={metrics.totalTransactions}
          hint={isOwner ? 'All cashiers combined' : 'Personal terminal total'}
          variant="forest"
        />
        <MetricCard
          label="Current Page Volume"
          value={`$${metrics.pageRevenue}`}
          hint={`${sales.length} transactions displayed`}
        />
        <MetricCard
          label="Role Permissions"
          value={user?.role?.toUpperCase() || '—'}
          hint={isOwner ? 'Unrestricted view' : 'Own transactions only'}
          variant="burgundy"
        />
        <MetricCard
          label="Audit Ledger Status"
          value="Synchronized"
          hint="PostgreSQL real-time records"
        />
      </MetricStrip>

      {/* Search & Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-2)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ maxWidth: 360, width: '100%' }}>
          <FormField label="Filter Ledger" hint="Filter by receipt number, cashier, or amount">
            <Input
              type="search"
              placeholder="Search receipt #, cashier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </FormField>
        </div>

        {pagination.total > 0 && (
          <div
            style={{
              fontSize: '12.5px',
              color: 'var(--text-muted)',
              marginBottom: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            Showing {sales.length} of {pagination.total} transaction{pagination.total === 1 ? '' : 's'} (Page{' '}
            {pagination.page} of {pagination.totalPages || 1})
          </div>
        )}
      </div>

      {/* Main Content: Loading, Error, Empty, or Table */}
      {isLoading ? (
        <LoadingState message="Retrieving transaction ledger from server..." />
      ) : fetchError ? (
        <ErrorState
          title="Unable to Retrieve Sales Ledger"
          message={fetchError}
          onRetry={() => loadSales(currentPage)}
        />
      ) : sales.length === 0 ? (
        <EmptyState
          title="No Sales Transactions Recorded"
          description={
            isCashier
              ? "You haven't processed any sales transactions yet. Use the POS Register to create customer bills."
              : 'No sales transactions have been recorded in the store ledger yet.'
          }
          action={
            isCashier ? (
              <Button variant="primary" onClick={() => navigate('/pos')}>
                Open POS Register
              </Button>
            ) : null
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={sortedSales}
          keyField="sale_id"
          sortKey={sortKey}
          sortDirection={sortDir}
          onSort={handleSort}
          emptyMessage="No sales found matching your filter criteria"
          pagination={{
            currentPage: pagination.page,
            totalPages: pagination.totalPages,
            totalItems: pagination.total,
            pageSize: pagination.limit,
            onPageChange: handlePageChange,
            disabled: isLoading,
          }}
        />
      )}

      {/* Itemized Receipt Modal */}
      <Modal
        isOpen={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          setReceiptData(null);
          setSelectedSaleSummary(null);
          setReceiptError(null);
        }}
        title={
          selectedSaleSummary
            ? `Receipt #${String(selectedSaleSummary.sale_id).padStart(5, '0')}`
            : 'Sale Receipt'
        }
        maxWidth={540}
        footer={
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-1)',
              width: '100%',
              justifyContent: 'space-between',
            }}
          >
            <Button
              variant="secondary"
              onClick={() => window.print()}
              disabled={isReceiptLoading || !receiptData}
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
                style={{ marginRight: 5 }}
                aria-hidden="true"
              >
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print Receipt
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setReceiptModalOpen(false);
                setReceiptData(null);
                setSelectedSaleSummary(null);
                setReceiptError(null);
              }}
            >
              Close
            </Button>
          </div>
        }
      >
        {isReceiptLoading ? (
          <div style={{ padding: '24px 0' }}>
            <LoadingState message="Retrieving itemized receipt details from server..." />
          </div>
        ) : receiptError ? (
          <ErrorState
            title="Receipt Details Unavailable"
            message={receiptError}
            onRetry={() => {
              if (selectedSaleSummary) {
                handleViewReceipt(selectedSaleSummary);
              }
            }}
          />
        ) : receiptData ? (
          <div style={{ padding: '4px 0' }}>
            {/* Header / Brand in Receipt */}
            <div
              style={{
                textAlign: 'center',
                paddingBottom: 'var(--space-2)',
                borderBottom: 'var(--border-hairline)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-wordmark)',
                  fontSize: '32px',
                  color: 'var(--color-forest)',
                  lineHeight: 1.1,
                }}
              >
                Nature's Basket
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                Official Sales Receipt & Tax Invoice
              </div>
            </div>

            {/* Transaction Metadata */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 6,
                padding: 'var(--space-2) 0',
                fontSize: '12.5px',
                borderBottom: 'var(--border-hairline)',
              }}
            >
              <div>
                Receipt #: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>#{receiptData.sale_id}</strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                Cashier: <strong>{receiptData.cashier_name}</strong>
              </div>
              <div>
                Date: {new Date(receiptData.sale_date).toLocaleDateString()}
              </div>
              <div style={{ textAlign: 'right' }}>
                Time: {new Date(receiptData.sale_date).toLocaleTimeString()}
              </div>
            </div>

            {/* Line Items Table */}
            <table
              className="nb-data-table"
              style={{ width: '100%', margin: 'var(--space-2) 0', fontSize: '13px' }}
            >
              <thead>
                <tr>
                  <th style={{ padding: '6px 8px' }}>Item</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', width: '50px' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', width: '80px' }}>Rate</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', width: '90px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {receiptData.items && receiptData.items.length > 0 ? (
                  receiptData.items.map((it) => (
                    <tr key={it.sale_item_id || it.product_id}>
                      <td style={{ padding: '6px 8px', fontWeight: 500 }}>
                        {it.product_name}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          padding: '6px 8px',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {it.quantity}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          padding: '6px 8px',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        ${Number(it.unit_price).toFixed(2)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          padding: '6px 8px',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                        }}
                      >
                        ${Number(it.subtotal).toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        textAlign: 'center',
                        padding: '16px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      No line items recorded for this sale.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Total Paid Section */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                paddingTop: 'var(--space-2)',
                borderTop: 'var(--border-strong)',
              }}
            >
              <span style={{ fontSize: '16px', fontWeight: 700 }}>Total Paid</span>
              <span
                style={{
                  fontFamily: 'var(--font-editorial)',
                  fontSize: '26px',
                  fontWeight: 700,
                  color: 'var(--color-forest)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ${Number(receiptData.total_amount).toFixed(2)}
              </span>
            </div>
          </div>
        ) : null}
      </Modal>
    </AppLayout>
  );
}
