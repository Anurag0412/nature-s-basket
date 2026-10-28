import { useState, useEffect, useMemo, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import PageHeader from '../components/layout/PageHeader';
import MetricStrip from '../components/ui/MetricStrip';
import MetricCard from '../components/ui/MetricCard';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import FormField from '../components/ui/FormField';
import Modal from '../components/ui/Modal';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { getInventory, updateStock } from '../api/inventoryApi';
import { getCategories } from '../api/categoryApi';
import { formatCurrency } from '../utils/currencyUtils';

const PAGE_SIZE = 10;

export default function InventoryScreen() {
  const { isOwner, isStaff } = useAuth();
  const toast = useToast();

  const canUpdateStock = isOwner || isStaff;

  // Data states
  const [inventory, setInventory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stockLevelFilter, setStockLevelFilter] = useState('all');

  // Sorting & Pagination
  const [sortKey, setSortKey] = useState('stock_quantity');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Restock Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [targetStock, setTargetStock] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load inventory and categories
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [invRes, catRes] = await Promise.all([
        getInventory(),
        getCategories(),
      ]);
      setInventory(invRes.data || []);
      setCategories(catRes.data || []);
    } catch (err) {
      console.error('Failed to load inventory data:', err);
      setFetchError(err.message || 'Failed to load inventory records');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial mount load with cancellation protection
  useEffect(() => {
    let ignore = false;
    Promise.all([getInventory(), getCategories()])
      .then(([invRes, catRes]) => {
        if (!ignore) {
          setInventory(invRes.data || []);
          setCategories(catRes.data || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setFetchError(err.message || 'Failed to load inventory records');
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Metrics computation
  const metrics = useMemo(() => {
    const totalItems = inventory.length;
    let healthyCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalUnitsOnHand = 0;

    for (const item of inventory) {
      const stock = Number(item.stock_quantity) || 0;
      const reorder = Number(item.reorder_level) || 0;
      totalUnitsOnHand += stock;

      if (stock === 0) {
        outOfStockCount += 1;
      } else if (stock <= reorder) {
        lowStockCount += 1;
      } else {
        healthyCount += 1;
      }
    }

    return {
      totalItems,
      healthyCount,
      lowStockCount,
      outOfStockCount,
      totalUnitsOnHand,
    };
  }, [inventory]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return inventory.filter((item) => {
      // Search by product name, category, or ID
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = (item.product_name || '').toLowerCase().includes(query);
        const matchesCategory = (item.category_name || '').toLowerCase().includes(query);
        const matchesId = String(item.product_id).includes(query);
        if (!matchesName && !matchesCategory && !matchesId) return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && String(item.category_id) !== String(categoryFilter)) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      // Stock level filter
      const stock = Number(item.stock_quantity) || 0;
      const reorder = Number(item.reorder_level) || 0;

      if (stockLevelFilter === 'low') {
        if (stock > reorder || stock === 0) return false;
      } else if (stockLevelFilter === 'out') {
        if (stock !== 0) return false;
      } else if (stockLevelFilter === 'deficit') {
        if (stock > reorder) return false;
      } else if (stockLevelFilter === 'healthy') {
        if (stock <= reorder) return false;
      }

      return true;
    });
  }, [inventory, searchQuery, categoryFilter, statusFilter, stockLevelFilter]);

  // Sorted items
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (
        sortKey === 'stock_quantity' ||
        sortKey === 'reorder_level' ||
        sortKey === 'price' ||
        sortKey === 'product_id'
      ) {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else if (sortKey === 'deficit') {
        aVal = (Number(a.reorder_level) || 0) - (Number(a.stock_quantity) || 0);
        bVal = (Number(b.reorder_level) || 0) - (Number(b.stock_quantity) || 0);
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.ceil(sortedItems.length / PAGE_SIZE) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedItems.slice(start, start + PAGE_SIZE);
  }, [sortedItems, currentPage]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Open restock modal
  const handleOpenRestock = (product) => {
    if (product.status !== 'active') {
      toast.error('Inactive products cannot be restocked. Please activate the product first.');
      return;
    }
    setSelectedProduct(product);
    setTargetStock(String(product.stock_quantity));
    setFormError('');
    setModalOpen(true);
  };

  // Handle stock update submission
  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const trimmed = String(targetStock).trim();
    const num = Number(trimmed);

    if (trimmed === '' || isNaN(num) || !Number.isInteger(num) || num < 0) {
      setFormError('Stock quantity must be a non-negative integer (e.g. 0, 10, 50).');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      await updateStock(selectedProduct.product_id, num);
      toast.success(
        `Stock for "${selectedProduct.product_name}" updated from ${selectedProduct.stock_quantity} to ${num} units.`
      );
      setModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to update stock:', err);
      const msg = err.message || 'Failed to update stock quantity.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Table columns definition
  const columns = [
    {
      key: 'product_id',
      label: 'SKU / ID',
      sortable: true,
      width: '100px',
      render: (val) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-muted)' }}>
          #{val}
        </span>
      ),
    },
    {
      key: 'product_name',
      label: 'Product & Department',
      sortable: true,
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{val}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {row.category_name}
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      label: 'Unit Price',
      sortable: true,
      align: 'right',
      render: (val) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      key: 'stock_quantity',
      label: 'Stock On Hand',
      sortable: true,
      align: 'right',
      render: (val, row) => {
        const stock = Number(val);
        const reorder = Number(row.reorder_level);
        let badgeVariant = 'in-stock';
        let badgeText = `${stock} units`;

        if (stock === 0) {
          badgeVariant = 'out-of-stock';
          badgeText = '0 (Out of Stock)';
        } else if (stock <= reorder) {
          badgeVariant = 'low-stock';
          badgeText = `${stock} units (Low)`;
        }

        return <Badge variant={badgeVariant}>{badgeText}</Badge>;
      },
    },
    {
      key: 'reorder_level',
      label: 'Threshold',
      sortable: true,
      align: 'right',
      render: (val) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
          {val} units
        </span>
      ),
    },
    {
      key: 'deficit',
      label: 'Stock Balance',
      sortable: true,
      align: 'right',
      render: (_, row) => {
        const stock = Number(row.stock_quantity);
        const reorder = Number(row.reorder_level);
        const diff = stock - reorder;

        if (diff < 0) {
          return (
            <span
              style={{
                color: 'var(--color-danger)',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                fontSize: '13px',
              }}
            >
              {diff} deficit
            </span>
          );
        } else if (diff === 0) {
          return (
            <span
              style={{
                color: 'var(--color-burgundy)',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                fontSize: '13px',
              }}
            >
              At limit (0 buffer)
            </span>
          );
        }

        return (
          <span
            style={{
              color: 'var(--color-forest)',
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              fontSize: '13px',
            }}
          >
            +{diff} surplus
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Catalog Status',
      sortable: true,
      align: 'center',
      render: (val) => (
        <Badge variant={val === 'active' ? 'active' : 'inactive'}>
          {val === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  // Actions column strictly for Staff and Owner
  if (canUpdateStock) {
    columns.push({
      key: 'actions',
      label: 'Replenishment',
      align: 'right',
      render: (_, row) => {
        const isInactive = row.status !== 'active';
        return (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenRestock(row)}
            disabled={isInactive}
            title={
              isInactive
                ? 'Product is inactive. Must be activated before restocking.'
                : 'Adjust stock quantity'
            }
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
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Restock
          </Button>
        );
      },
    });
  }

  // Stock update preview calculation
  const currentNum = selectedProduct ? Number(selectedProduct.stock_quantity) : 0;
  const parsedTarget = Number(targetStock);
  const isValidTarget =
    targetStock !== '' && !isNaN(parsedTarget) && Number.isInteger(parsedTarget) && parsedTarget >= 0;
  const delta = isValidTarget ? parsedTarget - currentNum : 0;

  return (
    <AppLayout>
      <PageHeader
        title="Inventory & Stock Management"
        subtitle="Real-time stock ledger, reorder deficit alerts, and atomic row-locked replenishment"
        badge={
          <Badge variant={metrics.lowStockCount + metrics.outOfStockCount > 0 ? 'low-stock' : 'active'}>
            {metrics.lowStockCount + metrics.outOfStockCount} Deficit Alerts
          </Badge>
        }
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
            <Button
              variant={stockLevelFilter === 'deficit' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setStockLevelFilter((prev) => (prev === 'deficit' ? 'all' : 'deficit'));
                setCurrentPage(1);
              }}
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
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {stockLevelFilter === 'deficit' ? 'Showing Deficits Only' : 'Filter Deficits'}
            </Button>
          </div>
        }
      />

      {/* Metric Strip (1px Solid Hairline Compartments) */}
      <MetricStrip>
        <MetricCard
          label="Catalog Tracked"
          value={metrics.totalItems}
          hint="All registered products"
        />
        <MetricCard
          label="Total Units On Hand"
          value={metrics.totalUnitsOnHand.toLocaleString()}
          hint="Aggregate physical stock"
          variant="forest"
        />
        <MetricCard
          label="Healthy Inventory"
          value={metrics.healthyCount}
          hint="Comfortably above reorder level"
        />
        <MetricCard
          label="Low Stock Alerts"
          value={metrics.lowStockCount}
          hint="At or below reorder threshold"
          variant={metrics.lowStockCount > 0 ? 'burgundy' : 'default'}
        />
        <MetricCard
          label="Out of Stock"
          value={metrics.outOfStockCount}
          hint="Immediate replenishment needed"
          variant={metrics.outOfStockCount > 0 ? 'danger' : 'default'}
        />
      </MetricStrip>

      {/* Filter and Search Bar */}
      <div className="nb-filter-strip">
        <div style={{ flex: '1 1 260px' }}>
          <Input
            type="search"
            placeholder="Search products by title, category, or SKU..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div style={{ minWidth: '180px' }}>
          <Select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: 'all', label: 'All Categories' },
              ...categories.map((c) => ({
                value: String(c.category_id),
                label: c.category_name,
              })),
            ]}
          />
        </div>

        <div style={{ minWidth: '150px' }}>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'active', label: 'Active Catalog' },
              { value: 'inactive', label: 'Archived / Inactive' },
            ]}
          />
        </div>

        <div style={{ minWidth: '180px' }}>
          <Select
            value={stockLevelFilter}
            onChange={(e) => {
              setStockLevelFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: 'all', label: 'All Stock Levels' },
              { value: 'deficit', label: 'Deficits (Low + Out)' },
              { value: 'low', label: 'Low Stock Only' },
              { value: 'out', label: 'Out of Stock Only' },
              { value: 'healthy', label: 'Adequate Stock (> Reorder)' },
            ]}
          />
        </div>

        {(searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' || stockLevelFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setCategoryFilter('all');
              setStatusFilter('all');
              setStockLevelFilter('all');
              setCurrentPage(1);
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <LoadingState message="Connecting to inventory database..." />
      ) : fetchError ? (
        <ErrorState
          title="Inventory Ledger Unavailable"
          message={fetchError}
          onRetry={loadData}
          retryText="Retry Connection"
        />
      ) : inventory.length === 0 ? (
        <EmptyState
          title="No Products in Inventory"
          description="There are currently no products registered in the inventory ledger."
        />
      ) : (
        <DataTable
          columns={columns}
          data={paginatedItems}
          keyField="product_id"
          sortKey={sortKey}
          sortDirection={sortDir}
          onSort={handleSort}
          emptyMessage="No inventory items match the specified filters."
          pagination={{
            currentPage,
            totalPages,
            totalItems: sortedItems.length,
            pageSize: PAGE_SIZE,
            onPageChange: (p) => setCurrentPage(p),
          }}
        />
      )}

      {/* Restock & Stock Update Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !isSubmitting && setModalOpen(false)}
        title="Restock Product"
        maxWidth={500}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleRestockSubmit}
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              Confirm Stock Update
            </Button>
          </>
        }
      >
        {selectedProduct && (
          <form onSubmit={handleRestockSubmit}>
            {/* Product summary card */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface-muted)',
                border: 'var(--border-hairline)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-2)',
                marginBottom: 'var(--space-2)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '15px' }}>
                {selectedProduct.product_name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                Category: <strong>{selectedProduct.category_name}</strong> • Unit Price:{' '}
                <strong>{formatCurrency(selectedProduct.price)}</strong>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-1)',
                  marginTop: 'var(--space-1-5)',
                  paddingTop: 'var(--space-1-5)',
                  borderTop: 'var(--border-hairline)',
                  fontSize: '13px',
                }}
              >
                <div>
                  Current Stock:{' '}
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {selectedProduct.stock_quantity} units
                  </strong>
                </div>
                <div>
                  Reorder Threshold:{' '}
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {selectedProduct.reorder_level} units
                  </strong>
                </div>
              </div>
            </div>

            {/* Quick Adjustment Increment Chips */}
            <div style={{ marginBottom: 'var(--space-2)' }}>
              <label className="nb-form-label" style={{ marginBottom: 6 }}>
                Quick Adjustments
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setTargetStock(String(currentNum + 10))}
                  disabled={isSubmitting}
                >
                  +10 units
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setTargetStock(String(currentNum + 25))}
                  disabled={isSubmitting}
                >
                  +25 units
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setTargetStock(String(currentNum + 50))}
                  disabled={isSubmitting}
                >
                  +50 units
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setTargetStock(String(selectedProduct.reorder_level))}
                  disabled={isSubmitting}
                >
                  Set to Threshold ({selectedProduct.reorder_level})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setTargetStock(String(selectedProduct.reorder_level * 2))}
                  disabled={isSubmitting}
                >
                  2× Threshold ({selectedProduct.reorder_level * 2})
                </Button>
              </div>
            </div>

            {/* Target Stock Input */}
            <FormField
              label="New Stock Quantity On Hand"
              htmlFor="target_stock"
              required
              error={formError}
              hint="Direct absolute count to save in database (atomic row-locked)"
            >
              <Input
                id="target_stock"
                type="number"
                min="0"
                step="1"
                value={targetStock}
                onChange={(e) => setTargetStock(e.target.value)}
                placeholder="0"
                disabled={isSubmitting}
                error={Boolean(formError)}
                autoFocus
              />
            </FormField>

            {/* Real-time Calculation Preview */}
            {isValidTarget && (
              <div
                style={{
                  marginTop: 'var(--space-1)',
                  padding: '10px 14px',
                  backgroundColor: delta >= 0 ? 'var(--color-forest-tint)' : 'var(--color-danger-tint)',
                  borderRadius: 'var(--radius-sharp)',
                  fontSize: '13px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  Net adjustment:{' '}
                  <strong>
                    {delta >= 0 ? `+${delta}` : delta} units
                  </strong>
                </span>
                <span>
                  Projected status:{' '}
                  <Badge
                    variant={
                      parsedTarget === 0
                        ? 'out-of-stock'
                        : parsedTarget <= Number(selectedProduct.reorder_level)
                        ? 'low-stock'
                        : 'in-stock'
                    }
                  >
                    {parsedTarget === 0
                      ? 'Out of Stock'
                      : parsedTarget <= Number(selectedProduct.reorder_level)
                      ? 'Low Stock Deficit'
                      : 'Adequate Stock'}
                  </Badge>
                </span>
              </div>
            )}
          </form>
        )}
      </Modal>
    </AppLayout>
  );
}
