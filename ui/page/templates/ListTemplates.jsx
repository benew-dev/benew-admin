'use client';

// ui/pages/templates/ListTemplates.jsx
// ============================================================================
// LIST TEMPLATES - Client Component
// ============================================================================
// Application: Admin Dashboard (5 utilisateurs/jour)
// Optimisé: Décembre 2025
// ============================================================================

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MdAdd,
  MdEdit,
  MdDelete,
  MdMonitor,
  MdPhoneIphone,
  MdCheckCircle,
  MdCancel,
  MdShoppingCart,
  MdDateRange,
  MdUpdate,
  MdWarning,
  MdClose,
  MdRefresh,
} from 'react-icons/md';
import { CldImage } from 'next-cloudinary';
import * as Sentry from '@sentry/nextjs';

import styles from '@/ui/styling/dashboard/templates/templates.module.css';

// ===== HELPER FUNCTIONS =====

/**
 * Formate une date en format FR
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ===== MAIN COMPONENT =====

export default function ListTemplates({ data: initialData = [] }) {
  const [templates, setTemplates] = useState(initialData);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'active' ou 'confirm'
  const [templateToDelete, setTemplateToDelete] = useState(null);

  const router = useRouter();

  // ===== DELETE HANDLERS =====

  /**
   * Ouvre le modal de suppression
   */
  const handleDeleteClick = useCallback((template) => {
    setTemplateToDelete(template);
    setModalType(template.is_active ? 'active' : 'confirm');
    setShowModal(true);

    Sentry.addBreadcrumb({
      category: 'ui',
      message: 'Delete template modal opened',
      data: {
        templateId: template.template_id,
        isActive: template.is_active,
      },
    });
  }, []);

  /**
   * Suppression optimiste avec rollback
   */
  const confirmDelete = async () => {
    if (!templateToDelete) return;

    const templateId = templateToDelete.template_id;
    const templateName = templateToDelete.template_name;

    setIsDeleting(true);
    setShowModal(false);

    // 1. Suppression optimiste (UI)
    const originalTemplates = templates;
    setTemplates((prev) => prev.filter((t) => t.template_id !== templateId));

    try {
      // 2. Appel API
      const response = await fetch(
        `/api/dashboard/templates/${templateId}/delete`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Échec de la suppression');
      }

      // 3. Succès
      Sentry.addBreadcrumb({
        category: 'api',
        message: 'Template deleted successfully',
        level: 'info',
        data: { templateId, templateName },
      });

      // Refresh pour garantir la cohérence
      router.refresh();
    } catch (error) {
      // 4. Rollback en cas d'erreur
      setTemplates(originalTemplates);

      const errorMessage =
        error.message || 'Erreur lors de la suppression du template';

      alert(errorMessage);

      Sentry.captureException(error, {
        tags: {
          component: 'list_templates',
          action: 'delete_template',
          error_category: 'api',
        },
        extra: {
          templateId,
          templateName,
        },
      });
    } finally {
      setIsDeleting(false);
      setTemplateToDelete(null);
    }
  };

  /**
   * Annule la suppression
   */
  const cancelDelete = useCallback(() => {
    setShowModal(false);
    setTemplateToDelete(null);
    setModalType('');
  }, []);

  /**
   * Refresh manuel
   */
  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  // ===== RENDER MODAL =====

  const renderModal = () => {
    if (!showModal || !templateToDelete) return null;

    return (
      <div className={styles.modalOverlay} onClick={cancelDelete}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <div className={styles.modalIcon}>
              {modalType === 'active' ? (
                <MdWarning className={styles.warningIcon} />
              ) : (
                <MdDelete className={styles.deleteIcon} />
              )}
            </div>
            <button
              className={styles.closeButton}
              onClick={cancelDelete}
              aria-label="Fermer"
            >
              <MdClose />
            </button>
          </div>

          <div className={styles.modalContent}>
            {modalType === 'active' ? (
              <>
                <h3 className={styles.modalTitle}>Template actif</h3>
                <p className={styles.modalMessage}>
                  Le template &quot;
                  <strong>{templateToDelete.template_name}</strong>&quot; ne
                  peut pas être supprimé car il est actuellement actif.
                </p>
                <p className={styles.modalSubmessage}>
                  Veuillez d&apos;abord désactiver ce template avant de pouvoir
                  le supprimer.
                </p>
              </>
            ) : (
              <>
                <h3 className={styles.modalTitle}>Confirmer la suppression</h3>
                <p className={styles.modalMessage}>
                  Êtes-vous sûr de vouloir supprimer le template &quot;
                  <strong>{templateToDelete.template_name}</strong>&quot; ?
                </p>
                <p className={styles.modalSubmessage}>
                  Cette action est irréversible. Le template et son image
                  associée seront définitivement supprimés.
                </p>
              </>
            )}
          </div>

          <div className={styles.modalActions}>
            {modalType === 'active' ? (
              <button
                className={styles.modalButtonPrimary}
                onClick={cancelDelete}
              >
                Compris
              </button>
            ) : (
              <>
                <button
                  className={styles.modalButtonSecondary}
                  onClick={cancelDelete}
                >
                  Annuler
                </button>
                <button
                  className={styles.modalButtonDanger}
                  onClick={confirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Suppression...' : 'Supprimer'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ===== RENDER MAIN =====

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.top}>
        <h1 className={styles.title}>Templates</h1>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshButton}
            onClick={handleRefresh}
            title="Actualiser la liste"
            aria-label="Actualiser"
          >
            <MdRefresh />
          </button>
          <Link href="/dashboard/templates/add">
            <button className={styles.addButton} type="button">
              <MdAdd /> Ajouter
            </button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className={styles.bottom}>
        {templates.length === 0 ? (
          <div className={styles.noTemplates}>
            <p>Aucun template trouvé. Ajoutez votre premier template.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {templates.map((template) => (
              <div
                key={template.template_id}
                className={`${styles.card} ${
                  template.is_active ? styles.activeCard : styles.inactiveCard
                }`}
              >
                {/* Image */}
                <div className={styles.imageContainer}>
                  {template.template_image ? (
                    <CldImage
                      src={template.template_image}
                      alt={template.template_name}
                      width={300}
                      height={200}
                      crop="fill"
                      className={styles.templateImage}
                    />
                  ) : (
                    <div className={styles.noImage}>
                      <span>Pas d&apos;image</span>
                    </div>
                  )}

                  {/* Status Badge */}
                  <div
                    className={`${styles.statusBadge} ${
                      template.is_active
                        ? styles.activeBadge
                        : styles.inactiveBadge
                    }`}
                  >
                    {template.is_active ? <MdCheckCircle /> : <MdCancel />}
                    <span>{template.is_active ? 'Actif' : 'Inactif'}</span>
                  </div>
                </div>

                {/* Content */}
                <div className={styles.cardContent}>
                  {/* Title & Platforms */}
                  <div className={styles.informations}>
                    <h3 className={styles.templateName}>
                      {template.template_name}
                    </h3>
                    <div className={styles.platforms}>
                      {template.template_has_web && <MdMonitor title="Web" />}
                      {template.template_has_mobile && (
                        <MdPhoneIphone title="Mobile" />
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className={styles.templateStats}>
                    <div className={styles.stat}>
                      <MdShoppingCart className={styles.statIcon} />
                      <span className={styles.statValue}>
                        {template.sales_count}
                      </span>
                      <span className={styles.statLabel}>ventes</span>
                    </div>
                    <div className={styles.stat}>
                      <MdDateRange className={styles.statIcon} />
                      <span className={styles.statValue}>
                        {formatDate(template.template_added)}
                      </span>
                      <span className={styles.statLabel}>créé</span>
                    </div>
                    <div className={styles.stat}>
                      <MdUpdate className={styles.statIcon} />
                      <span className={styles.statValue}>
                        {formatDate(template.updated_at)}
                      </span>
                      <span className={styles.statLabel}>mis à jour</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={styles.actions}>
                    <Link href={`/dashboard/templates/${template.template_id}`}>
                      <button
                        className={`${styles.actionButton} ${styles.editButton}`}
                        title="Modifier"
                      >
                        <MdEdit />
                      </button>
                    </Link>
                    <button
                      className={`${styles.actionButton} ${styles.deleteButton} ${
                        template.is_active ? styles.disabledButton : ''
                      }`}
                      onClick={() => handleDeleteClick(template)}
                      title={
                        template.is_active
                          ? 'Ce template est actif et ne peut pas être supprimé'
                          : 'Supprimer ce template'
                      }
                      disabled={template.is_active}
                    >
                      <MdDelete />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {renderModal()}
    </div>
  );
}
