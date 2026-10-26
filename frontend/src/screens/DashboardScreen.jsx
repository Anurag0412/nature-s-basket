import { useState, useEffect, useMemo, useCallback } from 'react';
import AppLayout from '../components/layout/AppLayout';
import PageHeader from '../components/layout/PageHeader';
import MetricStrip from '../components/ui/MetricStrip';
import MetricCard from '../components/ui/MetricCard';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import {
  getOverview,
  getSalesTrend,
  getTopProducts,
  getCashierPerformance,
} from '../api/analyticsApi';

/**
 * Format a Date object to YYYY-MM-DD
 */
function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Compute predefined date ranges
 */
function getPresetDates(preset) {
  const today = new Date();
  const end = toYMD(today);

  if (preset === 'today') {
    return { startDate: end, endDate: end };
  }
  if (preset === '7days') {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { startDate: toYMD(start), endDate: end };
  }
  if (preset === '30days') {
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    return { startDate: toYMD(start), endDate: end };
  }
  if (preset === '90days') {
    const start = new Date(today);
    start.setDate(today.getDate() - 89);
    return { startDate: toYMD(start), endDate: end };
  }
  return { startDate: end, endDate: end };
}

/**
 * Owner Dashboard & Analytics Screen
 *
 * Executive intelligence center for Nature's Basket store owners:
 * - Real-time overview KPIs (Revenue, Volume, Basket Size, Units Sold)
 * - Chronological sales trend visualizer with daily area and bar charts
 * - Top-selling products ranked by units sold and revenue contribution
 * - Cashier terminal performance and throughput audit
 * - Flexible calendar date-range filters and preset windows
 */
export default function DashboardScreen() {
  const { user } = useAuth();
  const toast = useToast();

  // Date range filter state
  const defaultRange = useMemo(() => getPresetDates('30days'), []);
  const [datePreset, setDatePreset] = useState('30days');
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [appliedRange, setAppliedRange] = useState(defaultRange);

  // Analytics data state
  const [overview, setOverview] = useState(null);
  const [salesTrend, setSalesTrend] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [cashierPerformance, setCashierPerformance] = useState([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState(null);
  const [trendMetric, setTrendMetric] = useState('revenue'); // 'revenue' | 'volume'

  // Load all analytics data for the active range
  const loadDashboardData = useCallback(async (range) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const params = {
        start_date: range.startDate,
        end_date: range.endDate,
      };

      const [overviewRes, trendRes, topRes, cashierRes] = await Promise.all([
        getOverview(params),
        getSalesTrend(params),
        getTopProducts({ ...params, limit: 6 }),
        getCashierPerformance(params),
      ]);

      if (overviewRes && overviewRes.success) {
        setOverview(overviewRes.data);
      }
      if (trendRes && trendRes.success) {
        setSalesTrend(trendRes.data || []);
      }
      if (topRes && topRes.success) {
        setTopProducts(topRes.data || []);
      }
      if (cashierRes && cashierRes.success) {
        setCashierPerformance(cashierRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load analytics dashboard data:', err);
      setFetchError(err.message || 'Unable to retrieve store analytics data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let ignore = false;
    const params = {
      start_date: defaultRange.startDate,
      end_date: defaultRange.endDate,
    };

    Promise.all([
      getOverview(params),
      getSalesTrend(params),
      getTopProducts({ ...params, limit: 6 }),
      getCashierPerformance(params),
    ])
      .then(([overviewRes, trendRes, topRes, cashierRes]) => {
        if (!ignore) {
          if (overviewRes && overviewRes.success) setOverview(overviewRes.data);
          if (trendRes && trendRes.success) setSalesTrend(trendRes.data || []);
          if (topRes && topRes.success) setTopProducts(topRes.data || []);
          if (cashierRes && cashierRes.success) setCashierPerformance(cashierRes.data || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error('Failed to load dashboard:', err);
          setFetchError(err.message || 'Unable to retrieve store analytics data');
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [defaultRange]);

  // Handle Preset change
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const range = getPresetDates(preset);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
      setAppliedRange(range);
      loadDashboardData(range);
      toast.info(`Analytics filtered for: ${preset === 'today' ? 'Today' : preset === '7days' ? 'Last 7 Days' : preset === '30days' ? 'Last 30 Days' : 'Last 90 Days'}`);
    }
  };

  // Handle Custom Date Range submit
  const handleApplyCustomDates = (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error('Both start date and end date must be specified.');
      return;
    }
    if (startDate > endDate) {
      toast.error('Start date cannot be after end date.');
      return;
    }

    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const diffDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
    if (diffDays > 366) {
      toast.error('Selected date range cannot exceed 366 days.');
      return;
    }

    const range = { startDate, endDate };
    setAppliedRange(range);
    loadDashboardData(range);
    toast.success(`Date range applied: ${startDate} to ${endDate}`);
  };

  // Trend computations for SVG rendering
  const trendMetrics = useMemo(() => {
    if (!salesTrend || salesTrend.length === 0) {
      return { maxRev: 1, maxUnits: 1, totalRev: 0, totalUnits: 0, hasSales: false };
    }

    let maxRev = 0;
    let maxUnits = 0;
    let totalRev = 0;
    let totalUnits = 0;

    for (const d of salesTrend) {
      const rev = Number(d.revenue) || 0;
      const u = Number(d.units_sold) || 0;
      if (rev > maxRev) maxRev = rev;
      if (u > maxUnits) maxUnits = u;
      totalRev += rev;
      totalUnits += u;
    }

    return {
      maxRev: maxRev > 0 ? maxRev : 100,
      maxUnits: maxUnits > 0 ? maxUnits : 10,
      totalRev,
      totalUnits,
      hasSales: totalRev > 0 || totalUnits > 0,
    };
  }, [salesTrend]);

  // SVG Chart Geometry
  const chartHeight = 220;
  const chartWidth = 800;
  const paddingX = 40;
  const paddingY = 24;

  const points = useMemo(() => {
    if (!salesTrend || salesTrend.length === 0) return [];

    const effectiveWidth = chartWidth - paddingX * 2;
    const effectiveHeight = chartHeight - paddingY * 2;
    const count = salesTrend.length;
    const stepX = count > 1 ? effectiveWidth / (count - 1) : effectiveWidth / 2;

    return salesTrend.map((d, i) => {
      const x = paddingX + i * stepX;
      const val = trendMetric === 'revenue' ? Number(d.revenue) : Number(d.units_sold);
      const max = trendMetric === 'revenue' ? trendMetrics.maxRev : trendMetrics.maxUnits;
      const ratio = val / max;
      const y = chartHeight - paddingY - ratio * effectiveHeight;
      return { x, y, data: d, val };
    });
  }, [salesTrend, trendMetric, trendMetrics, chartHeight, chartWidth]);

  // Line path string & Area fill path
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' };

    let line = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      line += ` L ${points[i].x} ${points[i].y}`;
    }

    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    const baselineY = chartHeight - paddingY;
    const area = `${line} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

    return { linePath: line, areaPath: area };
  }, [points, chartHeight, paddingY]);

  // Top products max units for proportional bar
  const maxProductUnits = useMemo(() => {
    if (!topProducts || topProducts.length === 0) return 1;
    return Math.max(...topProducts.map((p) => p.units_sold), 1);
  }, [topProducts]);

  return (
    <AppLayout>
      <PageHeader
        title="Store Intelligence & Analytics"
        subtitle="Executive performance dashboard, gross revenue trend, bestsellers, and cashier audit"
        badge={<Badge variant="active">Executive View: {user?.name || 'Store Owner'}</Badge>}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                loadDashboardData(appliedRange);
                toast.info('Analytics data refreshed');
              }}
              disabled={isLoading}
              title="Refresh all metrics"
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
              Refresh Data
            </Button>
          </div>
        }
      />

      {/* Date Range Selection Bar */}
      <section
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: 'var(--border-hairline)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 4 }}>
            Time Window:
          </span>
          <Button
            variant={datePreset === 'today' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => handlePresetChange('today')}
          >
            Today
          </Button>
          <Button
            variant={datePreset === '7days' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => handlePresetChange('7days')}
          >
            Last 7 Days
          </Button>
          <Button
            variant={datePreset === '30days' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => handlePresetChange('30days')}
          >
            Last 30 Days
          </Button>
          <Button
            variant={datePreset === '90days' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => handlePresetChange('90days')}
          >
            Quarter (90d)
          </Button>
          <Button
            variant={datePreset === 'custom' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setDatePreset('custom')}
          >
            Custom Range
          </Button>
        </div>

        {datePreset === 'custom' ? (
          <form
            onSubmit={handleApplyCustomDates}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexWrap: 'wrap' }}
          >
            <div style={{ width: 140 }}>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                aria-label="Start date"
              />
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
            <div style={{ width: 140 }}>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                aria-label="End date"
              />
            </div>
            <Button variant="secondary" size="sm" type="submit" disabled={isLoading}>
              Apply Filter
            </Button>
          </form>
        ) : (
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            Active Range: <strong>{appliedRange.startDate}</strong> through <strong>{appliedRange.endDate}</strong>
          </div>
        )}
      </section>

      {/* Main Content Area */}
      {isLoading ? (
        <LoadingState message="Calculating executive analytics and store performance..." />
      ) : fetchError ? (
        <ErrorState
          title="Analytics Service Unavailable"
          message={fetchError}
          onRetry={() => loadDashboardData(appliedRange)}
        />
      ) : (
        <>
          {/* Executive Overview Metric Strip */}
          <MetricStrip>
            <MetricCard
              label="Total Store Revenue"
              value={`$${overview ? Number(overview.total_revenue || 0).toFixed(2) : '0.00'}`}
              hint={`${overview ? overview.number_of_bills : 0} customer bills settled`}
              variant="forest"
            />
            <MetricCard
              label="Bills Processed"
              value={overview ? overview.number_of_bills : 0}
              hint="Total checkout volume"
            />
            <MetricCard
              label="Average Basket Size"
              value={`$${overview ? Number(overview.average_bill_value || 0).toFixed(2) : '0.00'}`}
              hint="Mean transaction revenue"
              variant="burgundy"
            />
            <MetricCard
              label="Total Units Dispensed"
              value={overview ? overview.total_units_sold : 0}
              hint="Physical units deducted"
            />
          </MetricStrip>

          {/* Sales Trend Visualizer */}
          <section
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: 'var(--border-hairline)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 'var(--space-2)',
                flexWrap: 'wrap',
                gap: 'var(--space-1)',
              }}
            >
              <div>
                <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', margin: 0 }}>
                  Daily Sales & Volume Trajectory
                </h2>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                  Continuous daily chronological timeline from PostgreSQL database
                </div>
              </div>

              {/* Metric Toggle */}
              <div style={{ display: 'inline-flex', border: 'var(--border-hairline)', borderRadius: 'var(--radius-sharp)', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setTrendMetric('revenue')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: trendMetric === 'revenue' ? 'var(--color-forest)' : 'var(--bg-surface)',
                    color: trendMetric === 'revenue' ? '#FFFFFF' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Revenue ($)
                </button>
                <button
                  type="button"
                  onClick={() => setTrendMetric('volume')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    borderLeft: 'var(--border-hairline)',
                    cursor: 'pointer',
                    backgroundColor: trendMetric === 'volume' ? 'var(--color-forest)' : 'var(--bg-surface)',
                    color: trendMetric === 'volume' ? '#FFFFFF' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Units Sold
                </button>
              </div>
            </div>

            {/* SVG Visualizer Chart */}
            {salesTrend.length === 0 ? (
              <EmptyState
                title="No Trend Data"
                description="No transaction records exist for the selected date range."
              />
            ) : (
              <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  style={{
                    width: '100%',
                    height: 'auto',
                    minWidth: '600px',
                    display: 'block',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <defs>
                    <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2C5F2D" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#2C5F2D" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guide Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = chartHeight - paddingY - ratio * (chartHeight - paddingY * 2);
                    const labelVal =
                      trendMetric === 'revenue'
                        ? `$${(ratio * trendMetrics.maxRev).toFixed(0)}`
                        : Math.round(ratio * trendMetrics.maxUnits);

                    return (
                      <g key={ratio}>
                        <line
                          x1={paddingX}
                          y1={y}
                          x2={chartWidth - paddingX}
                          y2={y}
                          stroke="rgba(31, 36, 33, 0.08)"
                          strokeDasharray="4 4"
                        />
                        <text
                          x={paddingX - 8}
                          y={y + 4}
                          textAnchor="end"
                          fontSize="10"
                          fill="var(--text-muted)"
                        >
                          {labelVal}
                        </text>
                      </g>
                    );
                  })}

                  {/* Area Fill */}
                  {areaPath && (
                    <path
                      d={areaPath}
                      fill="url(#trendAreaGradient)"
                      style={{ transition: 'all 0.3s ease' }}
                    />
                  )}

                  {/* Line Stroke */}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="var(--color-forest)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ transition: 'all 0.3s ease' }}
                    />
                  )}

                  {/* Data Points */}
                  {points.map((pt, idx) => {
                    const isHovered = hoveredTrendPoint === idx;
                    const hasActivity = pt.val > 0;

                    return (
                      <g
                        key={pt.data.date}
                        onMouseEnter={() => setHoveredTrendPoint(idx)}
                        onMouseLeave={() => setHoveredTrendPoint(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 6 : hasActivity ? 3.5 : 2}
                          fill={isHovered ? 'var(--color-forest)' : hasActivity ? '#FFFFFF' : 'rgba(31,36,33,0.3)'}
                          stroke="var(--color-forest)"
                          strokeWidth={isHovered ? 3 : 2}
                        />

                        {/* Transparent touch/hover hit zone */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={14}
                          fill="transparent"
                        />
                      </g>
                    );
                  })}

                  {/* X-Axis Date Labels (sample subset to avoid clutter) */}
                  {points.map((pt, idx) => {
                    const step = Math.max(1, Math.floor(points.length / 8));
                    const showLabel = idx === 0 || idx === points.length - 1 || idx % step === 0;

                    if (!showLabel) return null;
                    const d = new Date(pt.data.date + 'T00:00:00');
                    const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

                    return (
                      <text
                        key={`lbl-${pt.data.date}`}
                        x={pt.x}
                        y={chartHeight - 6}
                        textAnchor="middle"
                        fontSize="10.5"
                        fill="var(--text-muted)"
                      >
                        {label}
                      </text>
                    );
                  })}
                </svg>

                {/* Floating Tooltip when hovering over a point */}
                {hoveredTrendPoint !== null && points[hoveredTrendPoint] && (
                  <div
                    style={{
                      position: 'absolute',
                      top: Math.max(10, points[hoveredTrendPoint].y - 65),
                      left: Math.min(chartWidth - 170, Math.max(10, points[hoveredTrendPoint].x - 70)),
                      backgroundColor: 'rgba(31, 36, 33, 0.94)',
                      color: '#FFFFFF',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sharp)',
                      fontSize: '11.5px',
                      lineHeight: 1.4,
                      pointerEvents: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      zIndex: 10,
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#A3D9A5' }}>
                      {points[hoveredTrendPoint].data.date}
                    </div>
                    <div>
                      Revenue: <strong>${Number(points[hoveredTrendPoint].data.revenue).toFixed(2)}</strong>
                    </div>
                    <div>
                      Orders: {points[hoveredTrendPoint].data.number_of_bills} bills | Units: {points[hoveredTrendPoint].data.units_sold}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Dual-Column Analysis: Top Products & Cashier Audit */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            {/* 1. Top Selling Products */}
            <section
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: 'var(--border-hairline)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-3)',
              }}
            >
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', margin: 0 }}>
                  Best-Selling Merchandise
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                  Top merchandise ranked by volume and revenue contribution
                </div>
              </div>

              {topProducts.length === 0 ? (
                <EmptyState
                  title="No Bestsellers Recorded"
                  description="No product line items have been sold during this date range."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)' }}>
                  {topProducts.map((p, idx) => {
                    const percent = Math.round((p.units_sold / maxProductUnits) * 100);

                    return (
                      <div
                        key={p.product_id}
                        style={{
                          padding: '10px 12px',
                          border: 'var(--border-hairline)',
                          borderRadius: 'var(--radius-sharp)',
                          backgroundColor: 'var(--bg-surface-muted)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            marginBottom: 4,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                backgroundColor: idx === 0 ? 'var(--color-forest)' : 'rgba(31,36,33,0.12)',
                                color: idx === 0 ? '#FFFFFF' : 'var(--text-primary)',
                                fontSize: '10.5px',
                                fontWeight: 700,
                              }}
                            >
                              {idx + 1}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                              {p.product_name}
                            </span>
                          </div>
                          <span
                            style={{
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                              color: 'var(--color-forest)',
                              fontSize: '13.5px',
                            }}
                          >
                            ${Number(p.revenue).toFixed(2)}
                          </span>
                        </div>

                        {/* Bar representation */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            marginTop: 6,
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              height: 6,
                              backgroundColor: 'rgba(31, 36, 33, 0.08)',
                              borderRadius: 3,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${percent}%`,
                                height: '100%',
                                backgroundColor: 'var(--color-forest)',
                                borderRadius: 3,
                                transition: 'width 0.4s ease',
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--text-muted)',
                              fontVariantNumeric: 'tabular-nums',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {p.units_sold} unit{p.units_sold === 1 ? '' : 's'} sold
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 2. Cashier Performance & Audit */}
            <section
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: 'var(--border-hairline)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-3)',
              }}
            >
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', margin: 0 }}>
                  Cashier Register Audit
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                  Operator sales efficiency, transaction counts, and throughput
                </div>
              </div>

              {cashierPerformance.length === 0 ? (
                <EmptyState
                  title="No Cashier Activity"
                  description="No cashier users found or no sales recorded for this period."
                />
              ) : (
                <table
                  className="nb-data-table"
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  <thead>
                    <tr>
                      <th style={{ padding: '8px' }}>Cashier</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>Bills</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>Avg Basket</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>Gross Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashierPerformance.map((c) => {
                      const hasRevenue = Number(c.total_revenue) > 0;

                      return (
                        <tr key={c.cashier_id}>
                          <td style={{ padding: '8px', fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: hasRevenue ? 'var(--color-forest)' : 'var(--text-muted)',
                                  opacity: hasRevenue ? 1 : 0.4,
                                }}
                              />
                              <span>{c.cashier_name}</span>
                            </div>
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              padding: '8px',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {c.number_of_bills}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              padding: '8px',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            ${Number(c.average_bill_value).toFixed(2)}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              padding: '8px',
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: 700,
                              color: hasRevenue ? 'var(--color-forest)' : 'var(--text-muted)',
                            }}
                          >
                            ${Number(c.total_revenue).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </>
      )}
    </AppLayout>
  );
}
