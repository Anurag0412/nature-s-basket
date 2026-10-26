import { useState, useEffect, useMemo, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { getProducts } from '../api/productApi';
import { getCategories } from '../api/categoryApi';
import { createSale } from '../api/salesApi';

export default function PosScreen() {
  const { user } = useAuth();
  const toast = useToast();

  // Catalog data states
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [inStockOnly, setInStockOnly] = useState(true);

  // Cart / Bill state: Array of { product_id, product_name, category_name, price, stock_quantity, quantity }
  const [cart, setCart] = useState([]);

  // Checkout submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);

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
      console.error('Failed to load POS catalog:', err);
      setFetchError(err.message || 'Failed to load catalog data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial mount load with cancellation protection
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
          setFetchError(err.message || 'Failed to load catalog data');
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Filtered products list for POS selection
  const catalogList = useMemo(() => {
    return products.filter((p) => {
      // POS strictly excludes inactive products from checkout
      if (p.status !== 'active') return false;

      // In-stock filter
      if (inStockOnly && Number(p.stock_quantity) <= 0) return false;

      // Category filter
      if (categoryFilter !== 'all' && String(p.category_id) !== String(categoryFilter)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = (p.product_name || '').toLowerCase().includes(query);
        const matchesCategory = (p.category_name || '').toLowerCase().includes(query);
        const matchesId = String(p.product_id).includes(query);
        if (!matchesName && !matchesCategory && !matchesId) return false;
      }

      return true;
    });
  }, [products, searchQuery, categoryFilter, inStockOnly]);

  // Cart operations
  const addToCart = (product) => {
    if (product.status !== 'active' || Number(product.stock_quantity) <= 0) {
      toast.error(`"${product.product_name}" is out of stock.`);
      return;
    }

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product_id === product.product_id);
      if (existing) {
        if (existing.quantity >= Number(product.stock_quantity)) {
          toast.error(
            `Cannot add more "${product.product_name}". Only ${product.stock_quantity} units available.`
          );
          return prevCart;
        }
        return prevCart.map((item) =>
          item.product_id === product.product_id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prevCart,
        {
          product_id: product.product_id,
          product_name: product.product_name,
          category_name: product.category_name,
          price: Number(product.price),
          stock_quantity: Number(product.stock_quantity),
          quantity: 1,
        },
      ];
    });
  };

  const updateCartQuantity = (productId, newQuantity) => {
    const qty = parseInt(newQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product_id !== productId) return item;
        if (qty > item.stock_quantity) {
          toast.error(
            `Maximum available stock for "${item.product_name}" is ${item.stock_quantity} units.`
          );
          return { ...item, quantity: item.stock_quantity };
        }
        return { ...item, quantity: qty };
      })
    );
  };

  const incrementCartQuantity = (productId) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product_id !== productId) return item;
        if (item.quantity >= item.stock_quantity) {
          toast.error(`Cannot exceed stock limit (${item.stock_quantity} units).`);
          return item;
        }
        return { ...item, quantity: item.quantity + 1 };
      })
    );
  };

  const decrementCartQuantity = (productId) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.product_id !== productId) return item;
          return { ...item, quantity: item.quantity - 1 };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.product_id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Preview totals calculation (Backend database snapshot remains authoritative)
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cart]);

  const totalCartUnits = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Handle checkout submission
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('The cart is empty. Please add products to complete a sale.');
      return;
    }

    // Verify all cart quantities are valid
    for (const item of cart) {
      if (!item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        toast.error(`Invalid quantity for item "${item.product_name}".`);
        return;
      }
      if (item.quantity > item.stock_quantity) {
        toast.error(
          `Requested quantity for "${item.product_name}" exceeds stock limit (${item.stock_quantity} available).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      };

      const res = await createSale(payload);

      if (res && res.success && res.data) {
        toast.success(`Bill #${res.data.sale_id} processed successfully!`);
        setCompletedSale(res.data);
        clearCart();
        // Refresh catalog to reflect atomically decremented stock
        await loadData();
      } else {
        throw new Error(res.message || 'Transaction could not be confirmed.');
      }
    } catch (err) {
      console.error('Checkout failed:', err);
      toast.error(err.message || 'Failed to process checkout transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Point of Sale (POS) Register"
        subtitle="High-speed checkout terminal, real-time catalog prices, and atomic transaction settlement"
        badge={<Badge variant="active">Operator: {user?.name || user?.username}</Badge>}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(360px, 1fr)',
          gap: 'var(--space-3)',
          alignItems: 'start',
        }}
      >
        {/* ============================================================== */}
        {/* LEFT COLUMN: Merchandise Catalog & Quick Add                   */}
        {/* ============================================================== */}
        <section>
          {/* Filter and Search Bar */}
          <div className="nb-filter-strip" style={{ marginBottom: 'var(--space-2)' }}>
            <div style={{ flex: '1 1 200px' }}>
              <Input
                type="search"
                placeholder="Search catalog by title, SKU or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ minWidth: '160px' }}>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Departments' },
                  ...categories.map((c) => ({
                    value: String(c.category_id),
                    label: c.category_name,
                  })),
                ]}
              />
            </div>

            <div>
              <Button
                variant={inStockOnly ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setInStockOnly((prev) => !prev)}
                title="Toggle in-stock items only"
              >
                {inStockOnly ? 'In Stock Only' : 'Show All Active'}
              </Button>
            </div>
          </div>

          {/* Product Selection Table */}
          {isLoading ? (
            <LoadingState message="Loading catalog for register..." />
          ) : fetchError ? (
            <ErrorState
              title="Catalog Unavailable"
              message={fetchError}
              onRetry={loadData}
              retryText="Retry Connection"
            />
          ) : catalogList.length === 0 ? (
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: 'var(--border-hairline)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-4)',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              No active products found matching the criteria.
            </div>
          ) : (
            <div className="nb-table-surface" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              <table className="nb-data-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>SKU</th>
                    <th>Product & Department</th>
                    <th style={{ textAlign: 'right', width: '100px' }}>Price</th>
                    <th style={{ textAlign: 'right', width: '110px' }}>Stock</th>
                    <th style={{ textAlign: 'right', width: '90px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogList.map((prod) => {
                    const stock = Number(prod.stock_quantity);
                    const isOutOfStock = stock <= 0;
                    const inCart = cart.find((item) => item.product_id === prod.product_id);

                    return (
                      <tr
                        key={prod.product_id}
                        style={{
                          opacity: isOutOfStock ? 0.6 : 1,
                        }}
                      >
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-muted)' }}>
                          #{prod.product_id}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{prod.product_name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {prod.category_name}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          ${Number(prod.price).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Badge
                            variant={
                              isOutOfStock
                                ? 'out-of-stock'
                                : stock <= Number(prod.reorder_level)
                                ? 'low-stock'
                                : 'in-stock'
                            }
                          >
                            {isOutOfStock ? '0 units' : `${stock} units`}
                          </Badge>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={isOutOfStock}
                            onClick={() => addToCart(prod)}
                            title={isOutOfStock ? 'Out of stock' : 'Add to register bill'}
                          >
                            {inCart ? `+ Add (${inCart.quantity})` : '+ Add'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: Live Register Cart Ledger & Checkout             */}
        {/* ============================================================== */}
        <section
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: 'var(--border-hairline)',
            borderRadius: 'var(--radius-card)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(31, 36, 33, 0.04)',
          }}
        >
          {/* Cart Header */}
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderBottom: 'var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-surface-muted)',
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-editorial)',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Current Register Bill
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Cashier: {user?.name || user?.username}
              </span>
            </div>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart} disabled={isSubmitting}>
                Clear All
              </Button>
            )}
          </div>

          {/* Cart Items List */}
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              minHeight: '260px',
              maxHeight: 'calc(100vh - 420px)',
              overflowY: 'auto',
            }}
          >
            {cart.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: 'var(--space-6) var(--space-2)',
                  color: 'var(--text-muted)',
                }}
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: 0.4, marginBottom: 8 }}
                >
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: 4 }}>
                  Bill is empty
                </div>
                <div style={{ fontSize: '12px' }}>
                  Select merchandise from the catalog to begin checkout.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)' }}>
                {cart.map((item) => {
                  const lineTotal = item.price * item.quantity;
                  const isAtLimit = item.quantity >= item.stock_quantity;

                  return (
                    <div
                      key={item.product_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        backgroundColor: 'var(--bg-parchment)',
                        border: 'var(--border-hairline)',
                        borderRadius: 'var(--radius-sharp)',
                        gap: 10,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '13.5px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.product_name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          ${item.price.toFixed(2)} each • Max: {item.stock_quantity}
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          className="nb-btn nb-btn--secondary nb-btn--sm"
                          style={{ padding: '4px 8px', minWidth: 26, height: 26 }}
                          onClick={() => decrementCartQuantity(item.product_id)}
                          disabled={isSubmitting}
                          aria-label="Decrease quantity"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={item.stock_quantity}
                          value={item.quantity}
                          onChange={(e) => updateCartQuantity(item.product_id, e.target.value)}
                          disabled={isSubmitting}
                          style={{
                            width: '42px',
                            textAlign: 'center',
                            padding: '3px 0',
                            border: 'var(--border-hairline)',
                            borderRadius: 'var(--radius-sharp)',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 600,
                            fontSize: '13px',
                          }}
                        />
                        <button
                          type="button"
                          className="nb-btn nb-btn--secondary nb-btn--sm"
                          style={{ padding: '4px 8px', minWidth: 26, height: 26 }}
                          onClick={() => incrementCartQuantity(item.product_id)}
                          disabled={isSubmitting || isAtLimit}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      {/* Line Total */}
                      <div
                        style={{
                          minWidth: '65px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                          fontSize: '14px',
                        }}
                      >
                        ${lineTotal.toFixed(2)}
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product_id)}
                        disabled={isSubmitting}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 4,
                          lineHeight: 1,
                          fontSize: '16px',
                        }}
                        title="Remove line item"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Summary & Checkout Action */}
          <div
            style={{
              padding: 'var(--space-3)',
              borderTop: 'var(--border-hairline)',
              backgroundColor: 'var(--bg-surface-muted)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '13px',
                color: 'var(--text-muted)',
                marginBottom: 6,
              }}
            >
              <span>Total Line Items</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {cart.length} ({totalCartUnits} units)
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 'var(--space-2)',
                paddingTop: 6,
                borderTop: 'var(--border-hairline)',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '15px' }}>Total Amount</span>
              <span
                style={{
                  fontFamily: 'var(--font-editorial)',
                  fontSize: '28px',
                  fontWeight: 700,
                  color: 'var(--color-forest)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ${cartSubtotal.toFixed(2)}
              </span>
            </div>

            <Button
              id="checkout-submit-btn"
              variant="primary"
              disabled={isSubmitting || cart.length === 0}
              isLoading={isSubmitting}
              onClick={handleCheckout}
              style={{ width: '100%', padding: '12px 18px', fontSize: '15px' }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Complete Sale & Generate Bill
            </Button>

            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              Live database prices and row-locks enforce transaction accuracy.
            </div>
          </div>
        </section>
      </div>

      {/* ============================================================== */}
      {/* POST-CHECKOUT CONFIRMATION & RECEIPT MODAL                     */}
      {/* ============================================================== */}
      <Modal
        isOpen={Boolean(completedSale)}
        onClose={() => setCompletedSale(null)}
        title="Transaction Completed"
        maxWidth={520}
        footer={
          <div style={{ display: 'flex', gap: 'var(--space-1)', width: '100%', justifyContent: 'space-between' }}>
            <Button
              variant="secondary"
              onClick={() => {
                window.print();
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
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print Receipt
            </Button>
            <Button variant="primary" onClick={() => setCompletedSale(null)}>
              Start Next Sale
            </Button>
          </div>
        }
      >
        {completedSale && (
          <div style={{ padding: '4px 0' }}>
            {/* Header / Brand in Receipt */}
            <div style={{ textAlign: 'center', paddingBottom: 'var(--space-2)', borderBottom: 'var(--border-hairline)' }}>
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
                Official Sales Receipt
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
                Receipt #: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{completedSale.sale_id}</strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                Cashier: <strong>{completedSale.cashier_name}</strong>
              </div>
              <div>
                Date: {new Date(completedSale.sale_date).toLocaleDateString()}
              </div>
              <div style={{ textAlign: 'right' }}>
                Time: {new Date(completedSale.sale_date).toLocaleTimeString()}
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
                  <th style={{ textAlign: 'right', padding: '6px 8px' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px' }}>Rate</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {completedSale.items?.map((it) => (
                  <tr key={it.sale_item_id || it.product_id}>
                    <td style={{ padding: '6px 8px', fontWeight: 500 }}>{it.product_name}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>
                      {it.quantity}
                    </td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>
                      ${Number(it.unit_price).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      ${Number(it.subtotal).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total Section */}
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
                ${Number(completedSale.total_amount).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
