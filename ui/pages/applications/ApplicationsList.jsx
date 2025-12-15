// ui/pages/applications/ApplicationsList.jsx
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { MdAdd, MdMonitor, MdPhoneIphone } from 'react-icons/md';
import styles from '@/ui/styling/dashboard/applications/applicationsList.module.css';
import AppFilters from '@/ui/components/dashboard/AppFilters';
import AppSearch from '@/ui/components/dashboard/search/AppSearch';
import { getFilteredApplications } from '@/app/dashboard/applications/actions';
import {
  trackUI,
  trackNavigation,
  trackDatabaseError,
} from '@/utils/monitoring';

export default function ApplicationsList({ data }) {
  const router = useRouter();
  const [applications, setApplications] = useState(data);
  const [isPending, startTransition] = useTransition();
  const [currentFilters, setCurrentFilters] = useState({});
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    setApplications(data);
    trackUI('applications_list_mounted', {
      count: data.length,
    });
  }, [data]);

  // Gestion des filtres
  const handleFilterChange = (newFilters) => {
    setCurrentFilters(newFilters);
    setError(null);

    trackUI('filter_changed', {
      filtersCount: Object.keys(newFilters).length,
    });

    startTransition(async () => {
      try {
        const filteredData = await getFilteredApplications(newFilters);
        setApplications(filteredData);

        trackUI('filter_applied_successfully', {
          resultsCount: filteredData.length,
        });
      } catch (error) {
        console.error('Filter error:', error);
        setError('Failed to filter applications. Please try again.');
        trackDatabaseError(error, 'filter_applications_client');
      }
    });
  };

  // Effacer tous les filtres
  const clearAllFilters = () => {
    setCurrentFilters({});
    setError(null);

    trackUI('filters_cleared');

    startTransition(async () => {
      try {
        const allData = await getFilteredApplications({});
        setApplications(allData);
      } catch (error) {
        console.error('Clear filters error:', error);
        setError('Failed to clear filters. Please refresh the page.');
        trackDatabaseError(error, 'clear_filters_client');
      }
    });
  };

  // Suppression d'une application
  const handleDelete = async (id, images) => {
    if (!confirm('Are you sure you want to delete this application?')) {
      trackUI('delete_cancelled', { applicationId: id });
      return;
    }

    setDeleteId(id);
    setIsDeleting(true);

    trackUI('delete_started', { applicationId: id });

    try {
      const response = await fetch(`/api/dashboard/applications/${id}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, application_images: images }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        trackUI('delete_successful', { applicationId: id });
        router.refresh();
      }
    } catch (error) {
      console.error('Delete error:', error);
      setError('Failed to delete application. Please try again.');
      trackDatabaseError(error, 'delete_application_client', {
        applicationId: id,
      });
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  // Navigation
  const handleNavigate = (path, applicationId) => {
    trackNavigation('application_navigation', {
      path,
      applicationId,
    });
    router.push(path);
  };

  const hasActiveFilters = Object.keys(currentFilters).length > 0;

  return (
    <div className={styles.applicationsContainer}>
      {/* Header avec recherche et filtres */}
      <div className={styles.top}>
        <AppSearch
          placeholder="Search for an application..."
          onFilterChange={handleFilterChange}
          currentFilters={currentFilters}
        />
        <AppFilters
          onFilterChange={handleFilterChange}
          currentFilters={currentFilters}
        />
        <button
          onClick={() => handleNavigate('/dashboard/applications/add', null)}
          className={styles.addButton}
          type="button"
        >
          <MdAdd /> Add Application
        </button>
      </div>

      {/* Loading indicator */}
      {isPending && (
        <div className={styles.loading}>
          <span className={styles.loadingSpinner}></span>
          Filtering applications...
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

      {/* Grid des applications */}
      <div className={styles.applicationsGrid}>
        {applications && applications.length > 0 ? (
          applications.map((app) => (
            <div
              key={app.application_id}
              className={`${styles.applicationCard} ${app.is_active ? styles.activeCard : styles.inactiveCard}`}
            >
              {/* Status indicator */}
              <div
                className={`${styles.statusIndicator} ${app.is_active ? styles.activeIndicator : styles.inactiveIndicator}`}
              >
                <span className={styles.statusDot}></span>
                <span className={styles.statusText}>
                  {app.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Image */}
              <div className={styles.applicationImage}>
                {app.application_images?.[0] ? (
                  <Image
                    src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_300,h_200/${app.application_images[0]}`}
                    alt={app.application_name}
                    width={300}
                    height={200}
                    className={styles.image}
                  />
                ) : (
                  <div className={styles.image}>No Image</div>
                )}
              </div>

              {/* Détails */}
              <div className={styles.applicationDetails}>
                <div className={styles.titleSection}>
                  <h2>{app.application_name}</h2>
                  <div className={styles.categoryIcon}>
                    {app.application_category === 'mobile' && (
                      <MdPhoneIphone className={styles.mobileIcon} />
                    )}
                    {app.application_category === 'web' && (
                      <MdMonitor className={styles.webIcon} />
                    )}
                  </div>
                </div>

                <p className={styles.applicationType}>
                  Level {app.application_level}
                </p>
                <p>Fee: {app.application_fee} Fdj</p>
                <p>Rent: {app.application_rent} Fdj/month</p>
                {app.sales_count > 0 && <p>Sales: {app.sales_count}</p>}
                <a
                  href={app.application_link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit Application
                </a>
              </div>

              {/* Actions */}
              <div className={styles.applicationActions}>
                <Link
                  href={`/dashboard/applications/${app.application_id}`}
                  className={`${styles.actionLink} ${styles.viewLink}`}
                >
                  View
                </Link>
                <Link
                  href={`/dashboard/applications/${app.application_id}/edit`}
                  className={`${styles.actionLink} ${styles.editLink}`}
                >
                  Edit
                </Link>
                <button
                  disabled={app.is_active || isDeleting}
                  className={`${styles.actionButton} ${styles.deleteButton} ${app.is_active ? styles.disabled : ''}`}
                  onClick={() =>
                    !app.is_active &&
                    handleDelete(app.application_id, app.application_images)
                  }
                  title={
                    app.is_active
                      ? 'Deactivate before deleting'
                      : 'Delete application'
                  }
                >
                  {isDeleting && deleteId === app.application_id
                    ? 'Deleting...'
                    : 'Delete'}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.noResults}>
            <div className={styles.noResultsIcon}>📂</div>
            <p>
              {hasActiveFilters
                ? 'No applications match your current filters.'
                : 'No applications available.'}
            </p>
            {hasActiveFilters && (
              <button
                className={styles.clearFiltersButton}
                onClick={clearAllFilters}
                disabled={isPending}
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
