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
import ConfirmDialog from '../components/ui/ConfirmDialog';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { getProducts, createProduct, updateProduct, updateProductStatus } from '../api/productApi';
import { getCategories } from '../api/categoryApi';

const PAGE_SIZE = 10;

export default function ProductsScreen() {
  const { isOwner } = useAuth();
  const toast = useToast();

  // Data states
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');

  // Sorting & Pagination states
  const [sortKey, setSortKey] = useState('product_name');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal & Form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    product_name: '',
    category_id: '',
    price: '',
    stock_quantity: '',
    reorder_level: '',
  });
  const [formErrors, setFormErrors] = useState({});

  // Status toggle confirmation
  const [statusDialogProduct, setStatusDialogProduct] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Load products and categories from backend
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [prodRes, catRes] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
    } catch (err) {
      console.error('Failed to load products or categories:', err);
      setFetchError(err.message || 'Failed to load products from database');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.all([getProducts(), getCategories()])
      .then(([prodRes, catRes]) => {
        if (!ignore) {
          setProducts(prodRes.data || []);
          setCategories(catRes.data || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setFetchError(err.message || 'Failed to load products from database');
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Metric computations
  const metrics = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.status === 'active').length;
    const lowStock = products.filter(
      (p) => Number(p.stock_quantity) <= Number(p.reorder_level) && Number(p.stock_quantity) > 0
    ).length;
    const outOfStock = products.filter((p) => Number(p.stock_quantity) === 0).length;

    return { total, active, lowStock, outOfStock };
  }, [products]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search by product name or SKU/ID
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = (p.product_name || '').toLowerCase().includes(query);
        const matchesCategory = (p.category_name || '').toLowerCase().includes(query);
        const matchesId = String(p.product_id).includes(query);
        if (!matchesName && !matchesCategory && !matchesId) return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && String(p.category_id) !== String(categoryFilter)) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false;
      }

      // Stock condition filter
      if (stockFilter === 'low') {
        const isLow = Number(p.stock_quantity) <= Number(p.reorder_level) && Number(p.stock_quantity) > 0;
        if (!isLow) return false;
      } else if (stockFilter === 'out') {
        if (Number(p.stock_quantity) !== 0) return false;
      }

      return true;
    });
  }, [products, searchQuery, categoryFilter, statusFilter, stockFilter]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (sortKey === 'price' || sortKey === 'stock_quantity' || sortKey === 'reorder_level' || sortKey === 'product_id') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortKey, sortDir]);

  // Pagination slice
  const totalPages = Math.ceil(sortedProducts.length / PAGE_SIZE) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedProducts.slice(start, start + PAGE_SIZE);
  }, [sortedProducts, currentPage]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Open modal for adding a new product
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      product_name: '',
      category_id: categories.length > 0 ? String(categories[0].category_id) : '',
      price: '',
      stock_quantity: '',
      reorder_level: '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  // Open modal for editing an existing product
  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      product_name: product.product_name,
      category_id: String(product.category_id),
      price: String(product.price),
      stock_quantity: String(product.stock_quantity),
      reorder_level: String(product.reorder_level),
    });
    setFormErrors({});
    setModalOpen(true);
  };

  // Validate form fields according to backend constraints
  const validateForm = () => {
    const errors = {};

    if (!formData.product_name.trim()) {
      errors.product_name = 'Product name is required';
    }

    if (!formData.category_id) {
      errors.category_id = 'Category is required';
    }

    const priceNum = Number(formData.price);
    if (formData.price === '' || isNaN(priceNum) || priceNum < 0) {
      errors.price = 'Price must be a non-negative number';
    }

    const stockNum = Number(formData.stock_quantity);
    if (formData.stock_quantity === '' || isNaN(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
      errors.stock_quantity = 'Stock quantity must be a non-negative integer';
    }

    const reorderNum = Number(formData.reorder_level);
    if (formData.reorder_level === '' || isNaN(reorderNum) || !Number.isInteger(reorderNum) || reorderNum < 0) {
      errors.reorder_level = 'Reorder level must be a non-negative integer';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form submit handler
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        product_name: formData.product_name.trim(),
        category_id: Number(formData.category_id),
        price: Number(formData.price),
        stock_quantity: Number(formData.stock_quantity),
        reorder_level: Number(formData.reorder_level),
      };

      if (editingProduct) {
        await updateProduct(editingProduct.product_id, payload);
        toast.success(`Product "${payload.product_name}" updated successfully.`);
      } else {
        await createProduct(payload);
        toast.success(`Product "${payload.product_name}" added to catalog.`);
      }

      setModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save product:', err);
      toast.error(err.message || 'Failed to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prompt confirmation for status change
  const handleToggleStatusPrompt = (product) => {
    setStatusDialogProduct(product);
  };

  // Confirm status change
  const handleConfirmStatusChange = async () => {
    if (!statusDialogProduct) return;

    const newStatus = statusDialogProduct.status === 'active' ? 'inactive' : 'active';
    setIsUpdatingStatus(true);
    try {
      await updateProductStatus(statusDialogProduct.product_id, newStatus);
      toast.success(
        `Product "${statusDialogProduct.product_name}" is now marked as ${newStatus}.`
      );
      setStatusDialogProduct(null);
      await loadData();
    } catch (err) {
      console.error('Failed to update product status:', err);
      toast.error(err.message || 'Failed to update product status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Table columns definition
  const columns = [
    {
      key: 'product_id',
      label: 'ID / Code',
      sortable: true,
      width: '110px',
      render: (val) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-muted)' }}>
          #{val}
        </span>
      ),
    },
    {
      key: 'product_name',
      label: 'Product Name',
      sortable: true,
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{val}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Threshold: {row.reorder_level} units
          </div>
        </div>
      ),
    },
    {
      key: 'category_name',
      label: 'Category',
      sortable: true,
      render: (val) => val || '—',
    },
    {
      key: 'price',
      label: 'Unit Price',
      sortable: true,
      align: 'right',
      render: (val) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          ${Number(val).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'stock_quantity',
      label: 'Stock Level',
      sortable: true,
      align: 'right',
      render: (val, row) => {
        const stock = Number(val);
        const reorder = Number(row.reorder_level);
        let badgeVariant = 'in-stock';
        let stockLabel = `${stock} in stock`;

        if (stock === 0) {
          badgeVariant = 'out-of-stock';
          stockLabel = 'Out of Stock';
        } else if (stock <= reorder) {
          badgeVariant = 'low-stock';
          stockLabel = `${stock} (Low)`;
        }

        return <Badge variant={badgeVariant}>{stockLabel}</Badge>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      align: 'center',
      render: (val) => (
        <Badge variant={val === 'active' ? 'active' : 'inactive'}>
          {val === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  // Only append Actions column if user has write permissions (Owner)
  if (isOwner) {
    columns.push({
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenEdit(row)}
            title="Edit product details"
          >
            Edit
          </Button>
          <Button
            variant={row.status === 'active' ? 'ghost' : 'secondary'}
            size="sm"
            onClick={() => handleToggleStatusPrompt(row)}
            title={row.status === 'active' ? 'Deactivate product' : 'Activate product'}
          >
            {row.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    });
  }

  return (
    <AppLayout>
      <PageHeader
        title="Product Catalog"
        subtitle="Merchandise catalog, unit pricing, reorder thresholds, and inventory health"
        badge={<Badge variant="active">{products.length} Products</Badge>}
        actions={
          isOwner ? (
            <Button variant="primary" size="sm" onClick={handleOpenAdd}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Product
            </Button>
          ) : null
        }
      />

      {/* Metric Strip (1px Solid Hairline Compartments) */}
      <MetricStrip>
        <MetricCard label="Total Catalog" value={metrics.total} hint="All recorded items" />
        <MetricCard label="Active Items" value={metrics.active} hint="Available in register" variant="forest" />
        <MetricCard
          label="Low Stock Alerts"
          value={metrics.lowStock}
          hint="At or below reorder level"
          variant={metrics.lowStock > 0 ? 'burgundy' : 'default'}
        />
        <MetricCard
          label="Out of Stock"
          value={metrics.outOfStock}
          hint="Immediate replenishment needed"
          variant={metrics.outOfStock > 0 ? 'danger' : 'default'}
        />
      </MetricStrip>

      {/* Filter and Search Bar */}
      <div className="nb-filter-strip">
        <div style={{ flex: '1 1 260px' }}>
          <Input
            type="search"
            placeholder="Search by product name, SKU or ID..."
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

        <div style={{ minWidth: '140px' }}>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'active', label: 'Active Only' },
              { value: 'inactive', label: 'Inactive Only' },
            ]}
          />
        </div>

        <div style={{ minWidth: '160px' }}>
          <Select
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: 'all', label: 'All Stock Levels' },
              { value: 'low', label: 'Low Stock Deficit' },
              { value: 'out', label: 'Out of Stock' },
            ]}
          />
        </div>

        {(searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' || stockFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setCategoryFilter('all');
              setStatusFilter('all');
              setStockFilter('all');
              setCurrentPage(1);
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <LoadingState message="Loading catalog from database..." />
      ) : fetchError ? (
        <ErrorState
          title="Catalog Unavailable"
          message={fetchError}
          onRetry={loadData}
          retryText="Retry Connection"
        />
      ) : products.length === 0 ? (
        <EmptyState
          title="No Products in Catalog"
          description="Your store catalog does not have any items yet. Add your first merchandise item to begin."
          action={
            isOwner && (
              <Button variant="primary" size="sm" onClick={handleOpenAdd}>
                Add First Product
              </Button>
            )
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={paginatedProducts}
          keyField="product_id"
          sortKey={sortKey}
          sortDirection={sortDir}
          onSort={handleSort}
          emptyMessage="No products match the selected filters."
          pagination={{
            currentPage,
            totalPages,
            totalItems: sortedProducts.length,
            pageSize: PAGE_SIZE,
            onPageChange: (p) => setCurrentPage(p),
          }}
        />
      )}

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !isSubmitting && setModalOpen(false)}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
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
              onClick={handleFormSubmit}
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              {editingProduct ? 'Save Changes' : 'Create Product'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit}>
          <FormField
            label="Product Name"
            htmlFor="product_name"
            required
            error={formErrors.product_name}
          >
            <Input
              id="product_name"
              value={formData.product_name}
              onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
              placeholder="e.g. Organic Honeycomb 500g"
              disabled={isSubmitting}
              error={Boolean(formErrors.product_name)}
              autoFocus
            />
          </FormField>

          <FormField
            label="Category"
            htmlFor="category_id"
            required
            error={formErrors.category_id}
          >
            <Select
              id="category_id"
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              options={categories.map((c) => ({
                value: String(c.category_id),
                label: `${c.category_name} (${c.status})`,
              }))}
              disabled={isSubmitting}
              error={Boolean(formErrors.category_id)}
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            <FormField
              label="Unit Price ($)"
              htmlFor="price"
              required
              error={formErrors.price}
              hint="Selling price"
            >
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
                disabled={isSubmitting}
                error={Boolean(formErrors.price)}
              />
            </FormField>

            <FormField
              label="Stock Quantity"
              htmlFor="stock_quantity"
              required
              error={formErrors.stock_quantity}
              hint="Units on hand"
            >
              <Input
                id="stock_quantity"
                type="number"
                step="1"
                min="0"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                placeholder="0"
                disabled={isSubmitting}
                error={Boolean(formErrors.stock_quantity)}
              />
            </FormField>
          </div>

          <FormField
            label="Reorder Threshold Level"
            htmlFor="reorder_level"
            required
            error={formErrors.reorder_level}
            hint="Deficit alert triggers when inventory is at or below this level"
          >
            <Input
              id="reorder_level"
              type="number"
              step="1"
              min="0"
              value={formData.reorder_level}
              onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
              placeholder="10"
              disabled={isSubmitting}
              error={Boolean(formErrors.reorder_level)}
            />
          </FormField>
        </form>
      </Modal>

      {/* Confirmation Dialog for Status Change */}
      <ConfirmDialog
        isOpen={Boolean(statusDialogProduct)}
        onClose={() => !isUpdatingStatus && setStatusDialogProduct(null)}
        onConfirm={handleConfirmStatusChange}
        isLoading={isUpdatingStatus}
        title={
          statusDialogProduct?.status === 'active'
            ? 'Deactivate Product'
            : 'Activate Product'
        }
        message={
          statusDialogProduct?.status === 'active'
            ? `Are you sure you want to deactivate "${statusDialogProduct?.product_name}"? Inactive items will not be eligible for checkout in the POS register.`
            : `Are you sure you want to activate "${statusDialogProduct?.product_name}"? It will become immediately available for checkout.`
        }
        confirmText={
          statusDialogProduct?.status === 'active' ? 'Deactivate' : 'Activate'
        }
        confirmVariant={statusDialogProduct?.status === 'active' ? 'danger' : 'primary'}
      />
    </AppLayout>
  );
}
