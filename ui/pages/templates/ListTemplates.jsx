// ui/pages/templates/ListTemplates.jsx - CLIENT COMPONENT
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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

      // Optional: Show success toast
      // showToast('Template deleted successfully');
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

  if (templates.length === 0) {
    return (
      <div className="empty-state">
        <p>No templates found.</p>
        <button
          onClick={() => handleNavigate('/dashboard/templates/add', null)}
          className="btn-primary"
        >
          Create First Template
        </button>
      </div>
    );
  }

  return (
    <div className="templates-list">
      {/* Global Error */}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      {/* Templates Grid */}
      <div className="templates-grid">
        {templates.map((template) => (
          <article
            key={template.template_id}
            className="template-card"
            data-active={template.is_active}
          >
            {/* Template Image */}
            <div className="template-image">
              {template.template_images?.[0] ? (
                <Image
                  src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_300,h_200/${template.template_images[0]}`}
                  alt={template.template_name}
                  width={300}
                  height={200}
                  style={{ objectFit: 'cover' }}
                  priority={false}
                />
              ) : (
                <div className="no-image">No Image</div>
              )}

              {/* Active Badge */}
              {template.is_active && (
                <span className="badge active">Active</span>
              )}
            </div>

            {/* Template Info */}
            <div className="template-info">
              <h3>{template.template_name}</h3>

              {/* Meta Info */}
              <div className="template-meta">
                <span className="platforms">
                  {template.template_has_web && '🌐 Web'}
                  {template.template_has_web &&
                    template.template_has_mobile &&
                    ' • '}
                  {template.template_has_mobile && '📱 Mobile'}
                </span>
                <span className="images-count">
                  {template.template_images?.length || 0} image(s)
                </span>
              </div>

              {/* Sales Info */}
              {template.sales_count > 0 && (
                <div className="sales-info">{template.sales_count} sale(s)</div>
              )}

              {/* Actions */}
              <div className="template-actions">
                {/* View Details */}
                <button
                  onClick={() =>
                    handleNavigate(
                      `/dashboard/templates/${template.template_id}`,
                      template.template_id,
                    )
                  }
                  className="btn-view"
                  aria-label={`View ${template.template_name}`}
                >
                  View
                </button>

                {/* Edit */}
                <button
                  onClick={() =>
                    handleNavigate(
                      `/dashboard/templates/${template.template_id}/edit`,
                      template.template_id,
                    )
                  }
                  className="btn-edit"
                  aria-label={`Edit ${template.template_name}`}
                >
                  Edit
                </button>

                {/* Toggle Active */}
                <button
                  onClick={() =>
                    handleToggleActive(template.template_id, template.is_active)
                  }
                  className={`btn-toggle ${template.is_active ? 'active' : ''}`}
                  aria-label={`${template.is_active ? 'Deactivate' : 'Activate'} ${template.template_name}`}
                  aria-pressed={template.is_active}
                >
                  {template.is_active ? 'Deactivate' : 'Activate'}
                </button>

                {/* Delete */}
                <button
                  onClick={() =>
                    handleDelete(template.template_id, template.template_name)
                  }
                  disabled={
                    isDeleting === template.template_id || template.is_active
                  }
                  className="btn-delete"
                  aria-label={`Delete ${template.template_name}`}
                  aria-busy={isDeleting === template.template_id}
                  title={
                    template.is_active
                      ? 'Deactivate template before deleting'
                      : 'Delete template'
                  }
                >
                  {isDeleting === template.template_id
                    ? 'Deleting...'
                    : 'Delete'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Add New Button */}
      <div className="list-footer">
        <button
          onClick={() => handleNavigate('/dashboard/templates/add', null)}
          className="btn-primary btn-large"
        >
          + Add New Template
        </button>
      </div>
    </div>
  );
}
