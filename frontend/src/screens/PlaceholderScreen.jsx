import { useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import MetricStrip from '../components/ui/MetricStrip';
import MetricCard from '../components/ui/MetricCard';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import FormField from '../components/ui/FormField';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';

/**
 * Placeholder screen rendering inside the shared AppLayout shell.
 * Demonstrates shared UI components, page layout, and design system integration
 * while business screens await subsequent implementation steps.
 */
export default function PlaceholderScreen({ title, subtitle, badge }) {
  const { user } = useAuth();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [demoInput, setDemoInput] = useState('');
  const [demoSelect, setDemoSelect] = useState('active');
  const [tableSortKey, setTableSortKey] = useState('sku');
  const [tableSortDir, setTableSortDir] = useState('asc');
  const [tablePage, setTablePage] = useState(1);

  const sampleColumns = [
    { key: 'sku', label: 'SKU / Code', sortable: true, width: '130px' },
    { key: 'name', label: 'Item Name', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'stock', label: 'Stock Level', sortable: true, align: 'right' },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (val) => (
        <Badge variant={val === 'In Stock' ? 'in-stock' : val === 'Low Stock' ? 'low-stock' : 'inactive'}>
          {val}
        </Badge>
      ),
    },
  ];

  // Architectural UI demonstration data (schema compliance, no mock business DB)
  const sampleData = [
    { id: 1, sku: 'SKU-00101', name: 'Organic Honeycomb 500g', category: 'Pantry', stock: '24 units', status: 'In Stock' },
    { id: 2, sku: 'SKU-00102', name: 'Darjeeling First Flush Tea', category: 'Beverages', stock: '4 units', status: 'Low Stock' },
    { id: 3, sku: 'SKU-00103', name: 'Cold-Pressed Olive Oil 1L', category: 'Oils', stock: '18 units', status: 'In Stock' },
    { id: 4, sku: 'SKU-00104', name: 'Artisanal Sourdough Loaf', category: 'Bakery', stock: '0 units', status: 'Out of Stock' },
  ];

  const handleSort = (key) => {
    if (tableSortKey === key) {
      setTableSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setTableSortKey(key);
      setTableSortDir('asc');
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title={title}
        subtitle={subtitle}
        badge={badge && <Badge variant="active">{badge}</Badge>}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                toast.info(`System session active for ${user?.username} (${user?.role})`);
              }}
            >
              Test Toast
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setModalOpen(true)}
            >
              Open Dialog
            </Button>
          </div>
        }
      />

      {/* Restrained Metric Strip (1px Solid Hairline Compartments) */}
      <MetricStrip>
        <MetricCard label="Current Role" value={user?.role?.toUpperCase() || '—'} hint="RBAC Permission Scope" variant="forest" />
        <MetricCard label="Authenticated User" value={user?.username || '—'} hint={user?.name || 'Authorized Operator'} />
        <MetricCard label="Design Foundation" value="Parchment & Forest" hint="#FDFBF7 / #2C5F2D Hairlines" />
        <MetricCard label="Operational UI" value="Compact Tables" hint="Zero Image Overhead" variant="burgundy" />
      </MetricStrip>

      {/* Component Gallery & Integration Showcase */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        {/* Buttons & Badges */}
        <div style={{ backgroundColor: 'var(--bg-surface)', border: 'var(--border-hairline)', borderRadius: 'var(--radius-card)', padding: 'var(--space-3)' }}>
          <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', marginBottom: 'var(--space-2)' }}>
            Actions & Status Indicators
          </h2>
          <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
            <Button variant="primary" size="sm" onClick={() => toast.success('Primary action succeeded')}>
              Primary
            </Button>
            <Button variant="secondary" size="sm" onClick={() => toast.info('Secondary action triggered')}>
              Secondary
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
              Destructive
            </Button>
            <Button variant="ghost" size="sm">
              Ghost
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
            <Badge variant="in-stock">In Stock</Badge>
            <Badge variant="low-stock">Low Stock</Badge>
            <Badge variant="out-of-stock">Out of Stock</Badge>
            <Badge variant="inactive">Inactive</Badge>
          </div>
        </div>

        {/* Form Controls */}
        <div style={{ backgroundColor: 'var(--bg-surface)', border: 'var(--border-hairline)', borderRadius: 'var(--radius-card)', padding: 'var(--space-3)' }}>
          <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', marginBottom: 'var(--space-2)' }}>
            Operational Form Controls
          </h2>
          <FormField label="Search Inventory" hint="Filter by SKU or item title">
            <Input
              type="search"
              placeholder="Search products..."
              value={demoInput}
              onChange={(e) => setDemoInput(e.target.value)}
            />
          </FormField>
          <FormField label="Status Filter">
            <Select
              value={demoSelect}
              onChange={(e) => setDemoSelect(e.target.value)}
              options={[
                { value: 'all', label: 'All Merchandise' },
                { value: 'active', label: 'Active Catalog' },
                { value: 'inactive', label: 'Archived / Inactive' },
              ]}
            />
          </FormField>
        </div>
      </div>

      {/* Reusable Data Table */}
      <section style={{ marginBottom: 'var(--space-3)' }}>
        <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', marginBottom: 'var(--space-1-5)' }}>
          Operational Table Structure
        </h2>
        <DataTable
          columns={sampleColumns}
          data={sampleData}
          sortKey={tableSortKey}
          sortDirection={tableSortDir}
          onSort={handleSort}
          pagination={{
            currentPage: tablePage,
            totalPages: 3,
            totalItems: 12,
            pageSize: 4,
            onPageChange: (newPage) => setTablePage(newPage),
          }}
        />
      </section>

      {/* State Containers Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-2)' }}>
        <LoadingState message="Restocking ledger syncing..." />
        <EmptyState
          title="No Deficits Recorded"
          description="All inventory lines currently satisfy their configured reorder thresholds."
        />
        <ErrorState
          title="Connection Notice"
          message="Sample error handling demonstration."
          onRetry={() => toast.info('Retry handler activated')}
        />
      </div>

      {/* Reusable Modal Dialog */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Reusable Modal Component"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setModalOpen(false);
                toast.success('Modal operation confirmed');
              }}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
          This modal dialog enforces backdrop containment, escape-key termination, and
          preserves the heritage botanical aesthetic with Playfair Display editorial typography.
        </p>
      </Modal>

      {/* Reusable Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          toast.error('Destructive action confirmed');
        }}
        title="Confirm Destructive Action"
        message="Are you sure you wish to execute this destructive command? This demonstrates the reusable confirmation dialog."
        confirmText="Confirm Action"
        confirmVariant="danger"
      />
    </AppLayout>
  );
}
