// ui/pages/templates/ListTemplates.jsx - CLIENT COMPONENT
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import styles from '@/ui/styling/dashboard/templates/templates.module.css';
import {
  trackUI,
  trackNavigation,
  trackDatabaseError,
} from '@/utils/monitoring';

export default function ListTemplates({ initialTemplates }) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates || []);
  const [isDeleting, setIsDeleting] = useState(null);
  const [error, setError] = useState(null);

  // Track component mount
  useEffect(() => {
    trackUI('list_templates_mounted', {
      templatesCount: templates.length,
    });
  }, [templates.length]);

  // ===== DELETE TEMPLATE =====
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

    trackUI('delete_started', {
      templateId,
      templateName,
    });

    try {
      const response = await fetch(
        `/api/dashboard/templates/${templateId}/delete`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMsg =
          data.message || data.error || 'Failed to delete template';
        setError(errorMsg);

        trackUI(
          'delete_failed',
          {
            templateId,
            status: response.status,
            error: errorMsg,
          },
          'error',
        );

        return;
      }

      // Remove from UI
      setTemplates((prev) => prev.filter((t) => t.template_id !== templateId));

      trackUI('delete_successful', {
        templateId,
        templateName,
      });
    } catch (error) {
      console.error('Delete error:', error);
      const errorMsg = 'Network error. Please try again.';
      setError(errorMsg);

      trackDatabaseError(error, 'delete_template_client', {
        templateId,
        templateName,
      });
    } finally {
      setIsDeleting(null);
    }
  }, []);

  // ===== TOGGLE ACTIVE STATUS =====
  const handleToggleActive = useCallback(async (templateId, currentStatus) => {
    trackUI('toggle_active_started', {
      templateId,
      currentStatus,
    });

    try {
      const response = await fetch(
        `/api/dashboard/templates/${templateId}/edit`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isActive: !currentStatus,
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to toggle status');
      }

      // Update UI
      setTemplates((prev) =>
        prev.map((t) =>
          t.template_id === templateId
            ? { ...t, is_active: !currentStatus }
            : t,
        ),
      );

      trackUI('toggle_active_successful', {
        templateId,
        newStatus: !currentStatus,
      });
    } catch (error) {
      console.error('Toggle active error:', error);
      trackDatabaseError(error, 'toggle_active', {
        templateId,
      });
      setError('Failed to update template status');
    }
  }, []);

  // ===== NAVIGATION =====
  const handleNavigate = useCallback(
    (path, templateId) => {
      trackNavigation('template_navigation', {
        path,
        templateId,
      });
      router.push(path);
    },
    [router],
  );

  // ===== EMPTY STATE =====
  if (templates.length === 0) {
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
      {/* Global Error */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          role="alert"
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            style={{
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
          {templates.map((template) => (
            <article
              key={template.template_id}
              className={`${styles.card} ${template.is_active ? styles.activeCard : styles.inactiveCard}`}
            >
              {/* Template Image */}
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

                {/* Status Badge */}
                <span
                  className={`${styles.statusBadge} ${template.is_active ? styles.activeBadge : styles.inactiveBadge}`}
                >
                  {template.is_active ? '● Active' : '● Inactive'}
                </span>
              </div>

              {/* Card Content */}
              <div className={styles.cardContent}>
                {/* Template Name & Platforms */}
                <div className={styles.informations}>
                  <h3 className={styles.templateName}>
                    {template.template_name}
                  </h3>
                  <div className={styles.platforms}>
                    {template.template_has_web && '🌐'}
                    {template.template_has_mobile && '📱'}
                  </div>
                </div>

                {/* Template Stats */}
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

                {/* Actions */}
                <div className={styles.actions}>
                  {/* Edit */}
                  <button
                    onClick={() =>
                      handleNavigate(
                        `/dashboard/templates/${template.template_id}/edit`,
                        template.template_id,
                      )
                    }
                    className={`${styles.actionButton} ${styles.editButton}`}
                    aria-label={`Edit ${template.template_name}`}
                    title="Edit template"
                  >
                    ✏️
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() =>
                      handleDelete(template.template_id, template.template_name)
                    }
                    disabled={
                      isDeleting === template.template_id || template.is_active
                    }
                    className={`${styles.actionButton} ${styles.deleteButton} ${
                      (isDeleting === template.template_id ||
                        template.is_active) &&
                      styles.disabledButton
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
          ))}
        </div>
      </div>
    </div>
  );
}
