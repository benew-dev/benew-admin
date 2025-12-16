// ui/pages/platforms/PlatformsList.jsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MdAdd } from 'react-icons/md';
import styles from '@/ui/styling/dashboard/platforms/platforms.module.css';
import {
  trackUI,
  trackNavigation,
  trackDatabaseError,
} from '@/utils/monitoring';

export default function PlatformsList({ data }) {
  const router = useRouter();
  const [platforms, setPlatforms] = useState(data);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setPlatforms(data);
    trackUI('platforms_list_mounted', {
      platformCount: data?.length || 0,
      cashCount: data?.filter((p) => p.is_cash_payment).length || 0,
      electronicCount: data?.filter((p) => !p.is_cash_payment).length || 0,
    });
  }, [data]);

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
    } catch (error) {
      console.error('Delete error:', error);
      alert(error.message || 'Failed to delete platform. Please try again.');
      trackDatabaseError(error, 'delete_platform_client', { platformId: id });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.top}>
        <h1>Payment Platforms</h1>
        <Link
          href="/dashboard/platforms/add"
          onClick={() => trackNavigation('navigate_to_add_platform')}
        >
          <button className={styles.addButton} type="button">
            <MdAdd /> Add Platform
          </button>
        </Link>
      </div>

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
                    {/* ✅ NOUVEAU : Badge type (CASH ou Electronic) */}
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
                  {/* ✅ MODIFIÉ : Affichage conditionnel selon type */}
                  {platform.is_cash_payment ? (
                    // ====== AFFICHAGE CASH ======
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
                    // ====== AFFICHAGE ELECTRONIC ======
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
            <p>No payment platforms found.</p>
            <Link href="/dashboard/platforms/add">
              <button className={styles.addButton} type="button">
                <MdAdd /> Add Your First Platform
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
