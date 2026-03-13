// ui/pages/templates/ListTemplates.jsx - CLIENT COMPONENT
'use client';

import { useState, useCallback, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { MdAdd } from 'react-icons/md';
import styles from '@/ui/styling/dashboard/templates/templates.module.css';
import TemplatesSearch from '@/ui/components/dashboard/search/TemplatesSearch';
import TemplateFilters from '@/ui/components/dashboard/TemplateFilters';
import { getFilteredTemplates } from '@/app/dashboard/templates/actions';
import {
  trackUI,
  trackNavigation,
  trackDatabaseError,
} from '@/utils/monitoring';

export default function ListTemplates({ data }) {
  const router = useRouter();
  const [templates, setTemplates] = useState(data || []);
  const [isPending, startTransition] = useTransition();
  const [currentFilters, setCurrentFilters] = useState({});
  const [isDeleting, setIsDeleting] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setTemplates(data || []);
    trackUI('list_templates_mounted', { templatesCount: data?.length || 0 });
  }, [data]);

  // ===== FILTRES =====
  const handleFilterChange = (newFilters) => {
    setCurrentFilters(newFilters);
    setError(null);

    startTransition(async () => {
      try {
        const filteredData = await getFilteredTemplates(newFilters);
        setTemplates(filteredData);
      } catch (err) {
        console.error('Filter error:', err);
        setError('Failed to filter templates. Please try again.');
        trackDatabaseError(err, 'filter_templates_client');
      }
    });
  };

  const clearAllFilters = () => {
    setCurrentFilters({});
    setError(null);
    startTransition(async () => {
      try {
        const allData = await getFilteredTemplates({});
        setTemplates(allData);
      } catch (err) {
        setError('Failed to clear filters. Please refresh the page.');
      }
    });
  };

  // ===== DELETE =====
  const handleDelete = useCallback(async (templateId, templateName) => {
    if (
      !confirm(
        `Are you sure you want to delete "${templateName}"? This action cannot be undone.`,
      )
    ) {
      trackUI('delete_cancelled', { templateId });
      return;
    }

    setIsDeleting(templateId);
    setError(null);
    trackUI('delete_started', { templateId, templateName });

    try {
      const response = await fetch(
        `/api/dashboard/templates/${templateId}/delete`,
        { method: 'DELETE', headers: { 'Content-Type': 'application/json' } },
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMsg =
          data.message || data.error || 'Failed to delete template';
        setError(errorMsg);
        trackUI(
          'delete_failed',
          { templateId, status: response.status, error: errorMsg },
          'error',
        );
        return;
      }

      setTemplates((prev) => prev.filter((t) => t.template_id !== templateId));
      trackUI('delete_successful', { templateId, templateName });
    } catch (err) {
      console.error('Delete error:', err);
      setError('Network error. Please try again.');
      trackDatabaseError(err, 'delete_template_client', {
        templateId,
        templateName,
      });
    } finally {
      setIsDeleting(null);
    }
  }, []);

  // ===== NAVIGATION =====
  const handleNavigate = useCallback(
    (path, templateId) => {
      trackNavigation('template_navigation', { path, templateId });
      router.push(path);
    },
    [router],
  );

  const hasActiveFilters = Object.keys(currentFilters).length > 0;

  // ===== EMPTY STATE (aucun template en DB, pas de filtres actifs) =====
  if (!isPending && templates.length === 0 && !hasActiveFilters) {
    return (
      <div className={styles.container}>
        <div className={styles.noTemplates}>
          <div style={{ textAlign: 'center' }}>
            <p>No templates found.</p>
            <button
              onClick={() => handleNavigate('/dashboard/templates/add', null)}
              className={styles.addButton}
              style={{ marginTop: '20px' }}
            >
              + Create First Template
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ===== TOP BAR ===== */}
      <div className={styles.top}>
        <TemplatesSearch
          placeholder="Search for a template..."
          onFilterChange={handleFilterChange}
          currentFilters={currentFilters}
        />
        <TemplateFilters
          onFilterChange={handleFilterChange}
          currentFilters={currentFilters}
        />
        <Link
          href="/dashboard/templates/add"
          onClick={() => trackNavigation('navigate_to_add_template')}
        >
          <button className={styles.addButton} type="button">
            <MdAdd /> Add Template
          </button>
        </Link>
      </div>

      {/* Loading */}
      {isPending && (
        <div className={styles.loading}>
          <span className={styles.loadingSpinner}></span>
          Filtering templates...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#991b1b',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 8px',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Templates Grid */}
      <div className={styles.bottom}>
        <div className={styles.grid}>
          {templates.length > 0 ? (
            templates.map((template) => (
              <article
                key={template.template_id}
                className={`${styles.card} ${template.is_active ? styles.activeCard : styles.inactiveCard}`}
              >
                {/* Image */}
                <div className={styles.imageContainer}>
                  {template.template_images?.[0] ? (
                    <Image
                      src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_300,h_200/${template.template_images[0]}`}
                      alt={template.template_name}
                      width={300}
                      height={200}
                      className={styles.templateImage}
                    />
                  ) : (
                    <div className={styles.noImage}>No Image</div>
                  )}
                  <span
                    className={`${styles.statusBadge} ${template.is_active ? styles.activeBadge : styles.inactiveBadge}`}
                  >
                    {template.is_active ? '● Active' : '● Inactive'}
                  </span>
                </div>

                {/* Card Content */}
                <div className={styles.cardContent}>
                  <div className={styles.informations}>
                    <h3 className={styles.templateName}>
                      {template.template_name}
                    </h3>
                    <div className={styles.platforms}>
                      {template.template_has_web && '🌐'}
                      {template.template_has_mobile && '📱'}
                    </div>
                  </div>

                  <div className={styles.templateStats}>
                    <div className={styles.stat}>
                      <span className={styles.statIcon}>🖼️</span>
                      <span className={styles.statValue}>
                        {template.template_images?.length || 0}
                      </span>
                      <span className={styles.statLabel}>
                        image{template.template_images?.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {template.sales_count > 0 && (
                      <div className={styles.stat}>
                        <span className={styles.statIcon}>💰</span>
                        <span className={styles.statValue}>
                          {template.sales_count}
                        </span>
                        <span className={styles.statLabel}>
                          sale{template.sales_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={styles.actions}>
                    <button
                      onClick={() =>
                        handleNavigate(
                          `/dashboard/templates/${template.template_id}`,
                          template.template_id,
                        )
                      }
                      className={`${styles.actionButton} ${styles.editButton}`}
                      aria-label={`Edit ${template.template_name}`}
                      title="Edit template"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() =>
                        handleDelete(
                          template.template_id,
                          template.template_name,
                        )
                      }
                      disabled={
                        isDeleting === template.template_id ||
                        template.is_active
                      }
                      className={`${styles.actionButton} ${styles.deleteButton} ${
                        isDeleting === template.template_id ||
                        template.is_active
                          ? styles.disabledButton
                          : ''
                      }`}
                      aria-label={`Delete ${template.template_name}`}
                      aria-busy={isDeleting === template.template_id}
                      title={
                        template.is_active
                          ? 'Deactivate template before deleting'
                          : 'Delete template'
                      }
                    >
                      {isDeleting === template.template_id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            // Filtres actifs mais aucun résultat
            <div className={styles.noResults}>
              <div className={styles.noResultsIcon}>📋</div>
              <p>No templates match your current filters.</p>
              <button
                className={styles.clearFiltersButton}
                onClick={clearAllFilters}
                disabled={isPending}
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
