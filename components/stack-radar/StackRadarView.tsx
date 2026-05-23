/**
 * StackRadarView — Main Stack Radar page component
 * JK Zentra Finance Cockpit
 *
 * The Stack Radar is a focused "tool inventory" view showing all SaaS/tech
 * subscriptions. It features urgency-based visual sorting, entity filtering,
 * status filtering, search, and responsive layout (cards on mobile, table
 * on desktop).
 *
 * Features:
 * - Header with computed totals (next 30 days, monthly burn, annual commitment)
 * - Entity toggle (JK Zentra | Personal | All)
 * - Status filter (Active | Trial | All)
 * - Sort selector (urgency | amount | vendor | renewal date)
 * - Search by vendor name
 * - Responsive: grid of StackRadarCard on mobile, table of StackRadarRow on desktop
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import StackRadarCard from './StackRadarCard';
import StackRadarRow from './StackRadarRow';
import {
  filterForStackRadar,
  getUrgencyLevel,
  getDaysUntilRenewal,
  formatAmount,
  calculateTotalMonthlyBurn,
  calculateAnnualCommitment,
  calculateNext30DaysSpend,
  countRenewalsNext30Days,
} from '@/lib/utils/subscriptionUtils';
import type { SubscriptionRow } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Entity filter option */
type EntityFilter = 'jk-zentra' | 'personal' | 'all';

/** Status filter option */
type StatusFilter = 'active' | 'trial' | 'all';

/** Sort option */
type SortOption = 'urgency' | 'amount' | 'vendor' | 'renewal';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StackRadarViewProps {
  /** All subscriptions loaded from the database */
  subscriptions: SubscriptionRow[];
  /** Optional: entity name map for display (entity_id -> name) */
  entityNameMap?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * StackRadarView — the complete Stack Radar page.
 *
 * @param subscriptions — raw subscription rows from Supabase
 * @param entityNameMap — optional map of entity_id -> display name
 */
export default function StackRadarView({
  subscriptions,
  entityNameMap = {},
}: StackRadarViewProps): JSX.Element {
  // ---- Filter state ----
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('jk-zentra');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [sortBy, setSortBy] = useState<SortOption>('urgency');
  const [searchQuery, setSearchQuery] = useState('');

  // ---- Action handlers (callbacks) ----
  const handleEdit = useCallback((id: string) => {
    // TODO: wire to edit modal
    console.log('Edit subscription:', id);
  }, []);

  const handlePause = useCallback((id: string) => {
    // TODO: wire to pause confirmation
    console.log('Pause subscription:', id);
  }, []);

  const handleCancel = useCallback((id: string) => {
    // TODO: wire to cancel confirmation
    console.log('Cancel subscription:', id);
  }, []);

  // ---- Derived data ----

  /** Step 1: Filter for Stack Radar (is_stack_radar + relevant categories) */
  const radarSubs = useMemo(
    () => filterForStackRadar(subscriptions),
    [subscriptions],
  );

  /** Step 2: Apply entity filter */
  const entityFiltered = useMemo(() => {
    if (entityFilter === 'all') return radarSubs;
    // Map slug to entity name for matching against entityNameMap
    return radarSubs.filter((sub) => {
      const entityName = entityNameMap[sub.entity_id];
      if (entityFilter === 'jk-zentra') {
        return entityName === 'JK Zentra';
      }
      return entityName === 'Personal';
    });
  }, [radarSubs, entityFilter, entityNameMap]);

  /** Step 3: Apply status filter (excludes cancelled/archived by default) */
  const statusFiltered = useMemo(() => {
    return entityFiltered.filter((sub) => {
      if (statusFilter === 'all') {
        // "All" still excludes cancelled/archived for clarity
        return sub.status !== 'cancelled' && sub.status !== 'expired';
      }
      if (statusFilter === 'trial') {
        return sub.status === 'trial';
      }
      // statusFilter === 'active' — show active + paused (operational)
      return sub.status === 'active' || sub.status === 'paused';
    });
  }, [entityFiltered, statusFilter]);

  /** Step 4: Apply search */
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return statusFiltered;
    const q = searchQuery.toLowerCase().trim();
    return statusFiltered.filter(
      (sub) =>
        sub.vendor.toLowerCase().includes(q) ||
        sub.name.toLowerCase().includes(q) ||
        (sub.plan ?? '').toLowerCase().includes(q),
    );
  }, [statusFiltered, searchQuery]);

  /** Step 5: Sort */
  const sorted = useMemo(() => {
    const arr = [...searchFiltered];
    switch (sortBy) {
      case 'urgency':
        arr.sort((a, b) => {
          const ua = getUrgencyLevel(a.next_payment_at, a.status);
          const ub = getUrgencyLevel(b.next_payment_at, b.status);
          return ua.priority - ub.priority || a.vendor.localeCompare(b.vendor);
        });
        break;
      case 'amount':
        arr.sort((a, b) => b.amount_minor - a.amount_minor || a.vendor.localeCompare(b.vendor));
        break;
      case 'vendor':
        arr.sort((a, b) => a.vendor.localeCompare(b.vendor));
        break;
      case 'renewal': {
        arr.sort((a, b) => {
          // Subscriptions without a next_payment_at go to the bottom
          if (!a.next_payment_at && !b.next_payment_at) return a.vendor.localeCompare(b.vendor);
          if (!a.next_payment_at) return 1;
          if (!b.next_payment_at) return -1;
          const da = getDaysUntilRenewal(a.next_payment_at);
          const db = getDaysUntilRenewal(b.next_payment_at);
          return da - db || a.vendor.localeCompare(b.vendor);
        });
        break;
      }
      default:
        break;
    }
    return arr;
  }, [searchFiltered, sortBy]);

  // ---- Aggregate metrics ----
  const next30DaysSpend = useMemo(
    () => calculateNext30DaysSpend(sorted),
    [sorted],
  );
  const next30DaysCount = useMemo(
    () => countRenewalsNext30Days(sorted),
    [sorted],
  );
  const monthlyBurn = useMemo(
    () => calculateTotalMonthlyBurn(sorted),
    [sorted],
  );
  const annualCommitment = useMemo(
    () => calculateAnnualCommitment(sorted),
    [sorted],
  );

  // ---- Shared filter bar component ----
  const FilterBar = () => (
    <div className="flex flex-wrap items-center gap-3">
      {/* Entity toggle */}
      <div
        className="inline-flex overflow-hidden rounded-lg border"
        style={{ borderColor: '#E8E6E1' }}
      >
        {[
          { key: 'jk-zentra' as EntityFilter, label: 'JK Zentra' },
          { key: 'personal' as EntityFilter, label: 'Personal' },
          { key: 'all' as EntityFilter, label: 'All' },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => setEntityFilter(opt.key)}
            className="px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: entityFilter === opt.key ? '#181818' : '#FFFFFF',
              color: entityFilter === opt.key ? '#FFFFFF' : '#44403C',
            }}
            type="button"
            aria-pressed={entityFilter === opt.key}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div
        className="inline-flex overflow-hidden rounded-lg border"
        style={{ borderColor: '#E8E6E1' }}
      >
        {[
          { key: 'active' as StatusFilter, label: 'Active' },
          { key: 'trial' as StatusFilter, label: 'Trial' },
          { key: 'all' as StatusFilter, label: 'All' },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => setStatusFilter(opt.key)}
            className="px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: statusFilter === opt.key ? '#181818' : '#FFFFFF',
              color: statusFilter === opt.key ? '#FFFFFF' : '#44403C',
            }}
            type="button"
            aria-pressed={statusFilter === opt.key}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sort selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs" style={{ color: '#78716C' }}>
          Sort:
        </span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-stone-300"
          style={{ borderColor: '#E8E6E1', backgroundColor: '#FFFFFF', color: '#44403C' }}
          aria-label="Sort subscriptions"
        >
          <option value="urgency">Urgency</option>
          <option value="amount">Amount</option>
          <option value="vendor">Vendor</option>
          <option value="renewal">Renewal Date</option>
        </select>
      </div>

      {/* Search */}
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#A0A0A0"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-44 rounded-lg border py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-stone-300 sm:w-56"
            style={{ borderColor: '#E8E6E1', backgroundColor: '#FFFFFF', color: '#181818' }}
            aria-label="Search subscriptions by vendor"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF7' }}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ====== HEADER ====== */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            {/* Title + subtitle */}
            <div>
              <div className="mb-1 flex items-center gap-2">
                {/* Radar icon */}
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#181818"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1a11 11 0 0 0-11 11" />
                  <path d="M12 5a7 7 0 0 0-7 7" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                <h1 className="text-xl font-bold tracking-tight" style={{ color: '#181818' }}>
                  Stack Radar
                </h1>
              </div>
              <p className="text-sm" style={{ color: '#78716C' }}>
                Next 30 days:{" "}
                <span className="font-semibold" style={{ color: '#181818' }}>
                  {formatAmount(next30DaysSpend)}
                </span>{" "}
                across{' '}
                <span className="font-semibold" style={{ color: '#181818' }}>
                  {next30DaysCount}
                </span>{' '}
                tool{next30DaysCount === 1 ? '' : 's'}
              </p>
            </div>

            {/* Metric pills */}
            <div className="flex shrink-0 gap-3">
              <div
                className="rounded-lg border px-3 py-2"
                style={{ borderColor: '#E8E6E1', backgroundColor: '#FFFFFF' }}
              >
                <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: '#78716C' }}>
                  Monthly burn
                </p>
                <p
                  className="text-sm font-bold tabular-nums"
                  style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    color: '#181818',
                  }}
                >
                  {formatAmount(monthlyBurn)}
                </p>
              </div>
              <div
                className="rounded-lg border px-3 py-2"
                style={{ borderColor: '#E8E6E1', backgroundColor: '#FFFFFF' }}
              >
                <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: '#78716C' }}>
                  Annual
                </p>
                <p
                  className="text-sm font-bold tabular-nums"
                  style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    color: '#181818',
                  }}
                >
                  {formatAmount(annualCommitment)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ====== FILTER BAR ====== */}
        <div
          className="mb-6 rounded-xl border p-4"
          style={{ borderColor: '#E8E6E1', backgroundColor: '#FFFFFF' }}
        >
          <FilterBar />
        </div>

        {/* ====== RESULT COUNT ====== */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs" style={{ color: '#78716C' }}>
            Showing{' '}
            <span className="font-semibold" style={{ color: '#181818' }}>
              {sorted.length}
            </span>{' '}
            subscription{sorted.length === 1 ? '' : 's'}
            {searchQuery ? ` matching "${searchQuery}"` : ''}
          </p>
        </div>

        {/* ====== MOBILE: Card grid ====== */}
        <div className="grid gap-3 sm:hidden" role="list">
          {sorted.map((sub) => (
            <StackRadarCard
              key={sub.id}
              subscription={sub}
              onEdit={handleEdit}
              onPause={handlePause}
              onCancel={handleCancel}
            />
          ))}
          {sorted.length === 0 && (
            <EmptyState searchQuery={searchQuery} />
          )}
        </div>

        {/* ====== DESKTOP: Table ====== */}
        <div
          className="hidden overflow-hidden rounded-xl border sm:block"
          style={{ borderColor: '#E8E6E1', backgroundColor: '#FFFFFF' }}
        >
          <table className="w-full text-left" role="table">
            <thead>
              <tr style={{ backgroundColor: '#F5F5F4' }}>
                <th
                  className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: '#78716C' }}
                >
                  Vendor
                </th>
                <th
                  className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: '#78716C' }}
                >
                  Plan
                </th>
                <th
                  className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: '#78716C' }}
                >
                  Amount
                </th>
                <th
                  className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: '#78716C' }}
                >
                  Cycle
                </th>
                <th
                  className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: '#78716C' }}
                >
                  Days
                </th>
                <th
                  className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: '#78716C' }}
                >
                  Status
                </th>
                <th
                  className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: '#78716C' }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((sub) => (
                <StackRadarRow
                  key={sub.id}
                  subscription={sub}
                  onEdit={handleEdit}
                  onPause={handlePause}
                  onCancel={handleCancel}
                />
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <EmptyState searchQuery={searchQuery} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state (rendered inline in both mobile and desktop)
// ---------------------------------------------------------------------------

/**
 * EmptyState — shown when no subscriptions match the current filters.
 */
function EmptyState({ searchQuery }: { searchQuery: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#D6D3D1"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1a11 11 0 0 0-11 11" />
        <path d="M12 5a7 7 0 0 0-7 7" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
      <p className="mt-3 text-sm font-medium" style={{ color: '#78716C' }}>
        {searchQuery
          ? `No subscriptions match "${searchQuery}"`
          : 'No subscriptions found for this filter'}
      </p>
      <p className="mt-1 text-xs" style={{ color: '#A0A0A0' }}>
        {searchQuery
          ? 'Try a different search term or clear filters'
          : 'Try changing the entity or status filter'}
      </p>
    </div>
  );
}
