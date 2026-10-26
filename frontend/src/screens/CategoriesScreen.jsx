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
import {
  getCategories,
  createCategory,
  updateCategory,
  updateCategoryStatus,
} from '../api/categoryApi';
import { getProducts } from '../api/productApi';

const PAGE_SIZE = 10;

export default function CategoriesScreen() {
  const { isOwner } = useAuth();
  const toast = useToast();

  // Data states
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Sorting & Pagination
  const [sortKey, setSortKey] = useState('category_name');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status Change Confirmation
  const [statusDialogCategory, setStatusDialogCategory] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Load real categories and products from backend
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [catRes, prodRes] = await Promise.all([
        getCategories(),
        getProducts(),
      ]);
      setCategories(catRes.data || []);
      setProducts(prodRes.data || []);
    } catch (err) {
      console.error('Failed to load categories or products:', err);
      setFetchError(err.message || 'Failed to load categories from database');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.all([getCategories(), getProducts()])
      .then(([catRes, prodRes]) => {
        if (!ignore) {
          setCategories(catRes.data || []);
          setProducts(prodRes.data || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setFetchError(err.message || 'Failed to load categories from database');
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Compute product count map per category
  const productCountMap = useMemo(() => {
    const map = {};
    for (const prod of products) {
      const catId = prod.category_id;
      if (!map[catId]) {
        map[catId] = { total: 0, active: 0 };
      }
      map[catId].total += 1;
      if (prod.status === 'active') {
        map[catId].active += 1;
      }
    }
    return map;
  }, [products]);

  // Metrics computation
  const metrics = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.status === 'active').length;
    const inactive = categories.filter((c) => c.status === 'inactive').length;
    const totalItems = products.length;

    return { total, active, inactive, totalItems };
  }, [categories, products]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = (c.category_name || '').toLowerCase().includes(query);
        const matchesId = String(c.category_id).includes(query);
        if (!matchesName && !matchesId) return false;
      }

      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [categories, searchQuery, statusFilter]);

  // Sorted categories
  const sortedCategories = useMemo(() => {
    return [...filteredCategories].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (sortKey === 'category_id') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else if (sortKey === 'product_count') {
        aVal = productCountMap[a.category_id]?.total || 0;
        bVal = productCountMap[b.category_id]?.total || 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCategories, sortKey, sortDir, productCountMap]);

  // Paginated slice
  const totalPages = Math.ceil(sortedCategories.length / PAGE_SIZE) || 1;
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedCategories.slice(start, start + PAGE_SIZE);
  }, [sortedCategories, currentPage]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Open modal for adding a new category
  const handleOpenAdd = () => {
    setEditingCategory(null);
    setCategoryNameInput('');
    setFormError('');
    setModalOpen(true);
  };

  // Open modal for editing an existing category
  const handleOpenEdit = (category) => {
    setEditingCategory(category);
    setCategoryNameInput(category.category_name);
    setFormError('');
    setModalOpen(true);
  };

  // Submit Add or Edit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const trimmed = categoryNameInput.trim();
    if (!trimmed) {
      setFormError('Category name is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.category_id, { category_name: trimmed });
        toast.success(`Category renamed to "${trimmed}".`);
      } else {
        await createCategory({ category_name: trimmed });
        toast.success(`Category "${trimmed}" created successfully.`);
      }

      setModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save category:', err);
      const msg = err.message || 'Failed to save category.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status toggle confirmation
  const handleToggleStatusPrompt = (category) => {
    setStatusDialogCategory(category);
  };

  const handleConfirmStatusChange = async () => {
    if (!statusDialogCategory) return;

    const newStatus = statusDialogCategory.status === 'active' ? 'inactive' : 'active';
    setIsUpdatingStatus(true);
    try {
      await updateCategoryStatus(statusDialogCategory.category_id, newStatus);
      toast.success(
        `Category "${statusDialogCategory.category_name}" is now ${newStatus}.`
      );
      setStatusDialogCategory(null);
      await loadData();
    } catch (err) {
      console.error('Failed to update category status:', err);
      toast.error(err.message || 'Failed to update category status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Columns definition
  const columns = [
    {
      key: 'category_id',
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
      key: 'category_name',
      label: 'Category Name',
      sortable: true,
      render: (val) => <span style={{ fontWeight: 600 }}>{val}</span>,
    },
    {
      key: 'product_count',
      label: 'Products Cataloged',
      sortable: true,
      render: (_, row) => {
        const stats = productCountMap[row.category_id] || { total: 0, active: 0 };
        return (
          <div>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
              {stats.total} {stats.total === 1 ? 'item' : 'items'}
            </span>
            {stats.total > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 6 }}>
                ({stats.active} active)
              </span>
            )}
          </div>
        );
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

  // Only append Actions column if Owner
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
            title="Edit category name"
          >
            Edit
          </Button>
          <Button
            variant={row.status === 'active' ? 'ghost' : 'secondary'}
            size="sm"
            onClick={() => handleToggleStatusPrompt(row)}
            title={row.status === 'active' ? 'Deactivate category' : 'Activate category'}
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
        title="Merchandise Categories"
        subtitle="Store departments, department status, and inventory grouping"
        badge={<Badge variant="active">{categories.length} Categories</Badge>}
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
              Add Category
            </Button>
          ) : null
        }
      />

      {/* Metric Strip (1px Solid Hairline Compartments) */}
      <MetricStrip>
        <MetricCard label="Total Categories" value={metrics.total} hint="All departments" />
        <MetricCard label="Active Departments" value={metrics.active} hint="Available for cataloging" variant="forest" />
        <MetricCard
          label="Inactive Departments"
          value={metrics.inactive}
          hint="Archived / Disabled"
          variant={metrics.inactive > 0 ? 'burgundy' : 'default'}
        />
        <MetricCard
          label="Total Products Linked"
          value={metrics.totalItems}
          hint="Across all categories"
        />
      </MetricStrip>

      {/* Filter and Search Bar */}
      <div className="nb-filter-strip">
        <div style={{ flex: '1 1 260px' }}>
          <Input
            type="search"
            placeholder="Search categories by name or ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
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
              { value: 'active', label: 'Active Only' },
              { value: 'inactive', label: 'Inactive Only' },
            ]}
          />
        </div>

        {(searchQuery || statusFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setCurrentPage(1);
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <LoadingState message="Loading categories from database..." />
      ) : fetchError ? (
        <ErrorState
          title="Categories Unavailable"
          message={fetchError}
          onRetry={loadData}
          retryText="Retry Connection"
        />
      ) : categories.length === 0 ? (
        <EmptyState
          title="No Categories Defined"
          description="Your store does not have any product categories registered yet. Create your first category to organize products."
          action={
            isOwner && (
              <Button variant="primary" size="sm" onClick={handleOpenAdd}>
                Add First Category
              </Button>
            )
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={paginatedCategories}
          keyField="category_id"
          sortKey={sortKey}
          sortDirection={sortDir}
          onSort={handleSort}
          emptyMessage="No categories match the specified criteria."
          pagination={{
            currentPage,
            totalPages,
            totalItems: sortedCategories.length,
            pageSize: PAGE_SIZE,
            onPageChange: (p) => setCurrentPage(p),
          }}
        />
      )}

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !isSubmitting && setModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Add New Category'}
        maxWidth={460}
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
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit}>
          <FormField
            label="Category Name"
            htmlFor="category_name"
            required
            error={formError}
            hint="Department title (must be unique)"
          >
            <Input
              id="category_name"
              value={categoryNameInput}
              onChange={(e) => setCategoryNameInput(e.target.value)}
              placeholder="e.g. Artisanal Cheeses & Dairy"
              disabled={isSubmitting}
              error={Boolean(formError)}
              autoFocus
            />
          </FormField>
        </form>
      </Modal>

      {/* Confirmation Dialog for Status Change */}
      <ConfirmDialog
        isOpen={Boolean(statusDialogCategory)}
        onClose={() => !isUpdatingStatus && setStatusDialogCategory(null)}
        onConfirm={handleConfirmStatusChange}
        isLoading={isUpdatingStatus}
        title={
          statusDialogCategory?.status === 'active'
            ? 'Deactivate Category'
            : 'Activate Category'
        }
        message={
          statusDialogCategory?.status === 'active'
            ? `Are you sure you want to deactivate "${statusDialogCategory?.category_name}"? New products cannot be added under inactive categories.`
            : `Are you sure you want to activate "${statusDialogCategory?.category_name}"? It will become available for cataloging.`
        }
        confirmText={
          statusDialogCategory?.status === 'active' ? 'Deactivate' : 'Activate'
        }
        confirmVariant={statusDialogCategory?.status === 'active' ? 'danger' : 'primary'}
      />
    </AppLayout>
  );
}
