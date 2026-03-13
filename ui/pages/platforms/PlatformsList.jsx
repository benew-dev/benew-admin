// ui/pages/platforms/PlatformsList.jsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MdAdd } from 'react-icons/md';
import styles from '@/ui/styling/dashboard/platforms/platforms.module.css';
import PlatformsSearch from '@/ui/components/dashboard/search/PlatformsSearch';
import PlatformFilters from '@/ui/components/dashboard/PlatformFilters';
import { getFilteredPlatforms } from '@/app/dashboard/platforms/actions';
import {
  trackUI,
  trackNavigation,
  trackDatabaseError,
} from '@/utils/monitoring';

export default function PlatformsList({ data }) {
  const router = useRouter();
  const [platforms, setPlatforms] = useState(data);
  const [isPending, startTransition] = useTransition();
  const [currentFilters, setCurrentFilters] = useState({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPlatforms(data);
    trackUI('platforms_list_mounted', {
      platformCount: data?.length || 0,
      cashCount: data?.filter((p) => p.is_cash_payment).length || 0,
      electronicCount: data?.filter((p) => !p.is_cash_payment).length || 0,
    });
  }, [data]);

  // ===== FILTRES =====
  const handleFilterChange = (newFilters) => {
    setCurrentFilters(newFilters);
    setError(null);

    trackUI('platform_filter_changed', {
      filtersCount: Object.keys(newFilters).length,
    });

    startTransition(async () => {
      try {
        const filteredData = await getFilteredPlatforms(newFilters);
        setPlatforms(filteredData);

        trackUI('platform_filter_applied_successfully', {
          resultsCount: filteredData.length,
        });
      } catch (err) {
        console.error('Filter error:', err);
        setError('Failed to filter platforms. Please try again.');
        trackDatabaseError(err, 'filter_platforms_client');
      }
    });
  };

  const clearAllFilters = () => {
    setCurrentFilters({});
    setError(null);

    trackUI('platform_filters_cleared');

    startTransition(async () => {
      try {
        const allData = await getFilteredPlatforms({});
        setPlatforms(allData);
      } catch (err) {
        console.error('Clear filters error:', err);
        setError('Failed to clear filters. Please refresh the page.');
        trackDatabaseError(err, 'clear_platform_filters_client');
      }
    });
  };

  // ===== DELETE =====
  const handleDelete = async (id, platformName) => {
    if (
      !confirm(`Are you sure you want to delete platform "${platformName}"?`)
    ) {
      trackUI('delete_cancelled', { platformId: id });
      return;
    }

    setIsDeleting(true);
    trackUI('delete_started', { platformId: id });

    try {
      const response = await fetch(`/api/dashboard/platforms/${id}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        trackUI('delete_successful', { platformId: id });
        router.refresh();
      } else {
        throw new Error(data.message || 'Delete failed');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert(err.message || 'Failed to delete platform. Please try again.');
      trackDatabaseError(err, 'delete_platform_client', { platformId: id });
    } finally {
      setIsDeleting(false);
    }
  };

  const hasActiveFilters = Object.keys(currentFilters).length > 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.top}>
        <PlatformsSearch
          placeholder="Search for a platform..."
          onFilterChange={handleFilterChange}
          currentFilters={currentFilters}
        />
        <PlatformFilters
          onFilterChange={handleFilterChange}
          currentFilters={currentFilters}
        />
        <Link
          href="/dashboard/platforms/add"
          onClick={() => trackNavigation('navigate_to_add_platform')}
        >
          <button className={styles.addButton} type="button">
            <MdAdd /> Add Platform
          </button>
        </Link>
      </div>

      {/* Loading */}
      {isPending && (
        <div className={styles.loading}>
          <span className={styles.loadingSpinner}></span>
          Filtering platforms...
        </div>
      )}

      {/* Erreurs */}
      {error && (
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          {error}
          <button
            className={styles.retryButton}
            onClick={() => handleFilterChange(currentFilters)}
          >
            Retry
          </button>
        </div>
      )}

      {/* Grid */}
      <div className={styles.platformsGrid}>
        {platforms && platforms.length > 0 ? (
          platforms.map((platform) => (
            <div
              key={platform.platform_id}
              className={`${styles.platformCard} ${platform.is_active ? styles.active : styles.inactive}`}
            >
              <div className={styles.platformDetails}>
                <div className={styles.platformHeader}>
                  <div className={styles.titleGroup}>
                    <h2>{platform.platform_name}</h2>
                    <span
                      className={
                        platform.is_cash_payment
                          ? styles.cashBadge
                          : styles.electronicBadge
                      }
                    >
                      {platform.is_cash_payment ? '💵 CASH' : '💳 Electronic'}
                    </span>
                  </div>
                  <span
                    className={`${styles.statusBadge} ${platform.is_active ? styles.active : styles.inactive}`}
                  >
                    {platform.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className={styles.platformInfo}>
                  {platform.is_cash_payment ? (
                    <>
                      <div className={styles.infoRow}>
                        <span className={styles.label}>Type:</span>
                        <span className={styles.value}>Cash Payment</span>
                      </div>

                      {platform.description && (
                        <div className={styles.infoRow}>
                          <span className={styles.label}>Description:</span>
                          <span className={styles.value}>
                            {platform.description}
                          </span>
                        </div>
                      )}

                      <div className={styles.infoRow}>
                        <span className={styles.label}>Created:</span>
                        <span className={styles.value}>
                          {new Date(platform.created_at).toLocaleDateString(
                            'en-US',
                            {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          )}
                        </span>
                      </div>

                      {platform.updated_at && (
                        <div className={styles.infoRow}>
                          <span className={styles.label}>Updated:</span>
                          <span className={styles.value}>
                            {new Date(platform.updated_at).toLocaleDateString(
                              'en-US',
                              {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            )}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className={styles.infoRow}>
                        <span className={styles.label}>Type:</span>
                        <span className={styles.value}>
                          Electronic Platform
                        </span>
                      </div>

                      <div className={styles.infoRow}>
                        <span className={styles.label}>Account Name:</span>
                        <span className={styles.value}>
                          {platform.account_name}
                        </span>
                      </div>

                      <div className={styles.infoRow}>
                        <span className={styles.label}>Account Number:</span>
                        <span className={styles.value}>
                          {platform.account_number}
                        </span>
                      </div>

                      {platform.description && (
                        <div className={styles.infoRow}>
                          <span className={styles.label}>Description:</span>
                          <span className={styles.value}>
                            {platform.description}
                          </span>
                        </div>
                      )}

                      <div className={styles.infoRow}>
                        <span className={styles.label}>Created:</span>
                        <span className={styles.value}>
                          {new Date(platform.created_at).toLocaleDateString(
                            'en-US',
                            {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          )}
                        </span>
                      </div>

                      {platform.updated_at && (
                        <div className={styles.infoRow}>
                          <span className={styles.label}>Updated:</span>
                          <span className={styles.value}>
                            {new Date(platform.updated_at).toLocaleDateString(
                              'en-US',
                              {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            )}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className={styles.platformActions}>
                <Link
                  href={`/dashboard/platforms/edit/${platform.platform_id}`}
                  onClick={() =>
                    trackNavigation('navigate_to_edit_platform', {
                      platformId: platform.platform_id,
                      isCashPayment: platform.is_cash_payment,
                    })
                  }
                >
                  <button
                    className={`${styles.actionButton} ${styles.editButton}`}
                  >
                    Edit
                  </button>
                </Link>
                <button
                  disabled={platform.is_active || isDeleting}
                  className={`${styles.actionButton} ${styles.deleteButton} ${
                    platform.is_active || isDeleting ? styles.disabled : ''
                  }`}
                  onClick={() =>
                    !platform.is_active &&
                    !isDeleting &&
                    handleDelete(platform.platform_id, platform.platform_name)
                  }
                  title={
                    platform.is_active
                      ? 'Cannot delete active platform. Please deactivate first.'
                      : isDeleting
                        ? 'Deleting...'
                        : 'Delete platform'
                  }
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>
            <p>
              {hasActiveFilters
                ? 'No platforms match your current filters.'
                : 'No payment platforms found.'}
            </p>
            {hasActiveFilters ? (
              <button
                className={styles.addButton}
                onClick={clearAllFilters}
                disabled={isPending}
                type="button"
              >
                Clear All Filters
              </button>
            ) : (
              <Link href="/dashboard/platforms/add">
                <button className={styles.addButton} type="button">
                  <MdAdd /> Add Your First Platform
                </button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
