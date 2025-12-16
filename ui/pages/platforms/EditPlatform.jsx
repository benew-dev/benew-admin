'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/ui/styling/dashboard/platforms/editPlatform.module.css';
import { MdSave, MdCancel, MdInfo, MdEdit } from 'react-icons/md';
import {
  trackForm,
  trackValidation,
  trackDatabaseError,
} from '@/utils/monitoring';

const EditPlatform = ({ platform }) => {
  const router = useRouter();

  const [formData, setFormData] = useState({
    platformName: '',
    accountName: '',
    accountNumber: '',
    isCashPayment: false, // ✅ NOUVEAU
    description: '', // ✅ NOUVEAU
    isActive: true,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Initialiser le formulaire
  useEffect(() => {
    if (platform) {
      setFormData({
        platformName: platform.platform_name || '',
        accountName: platform.account_name || '',
        accountNumber: platform.account_number || '',
        isCashPayment: platform.is_cash_payment || false, // ✅ NOUVEAU
        description: platform.description || '', // ✅ NOUVEAU
        isActive: platform.is_active !== undefined ? platform.is_active : true,
      });
    }
  }, [platform]);

  // ✅ NOUVEAU : Gérer le changement de isCashPayment
  const handleCashPaymentChange = (e) => {
    const isChecked = e.target.checked;
    setFormData((prev) => ({
      ...prev,
      isCashPayment: isChecked,
      accountName: isChecked ? '' : prev.accountName,
      accountNumber: isChecked ? '' : prev.accountNumber,
      description: isChecked
        ? 'Paiement en espèces lors de la récupération'
        : prev.description,
    }));
    setHasChanges(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData((prev) => ({ ...prev, [name]: newValue }));
    setHasChanges(true);

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }

    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.platformName.trim()) {
      newErrors.platformName = 'Platform name is required';
    } else if (formData.platformName.trim().length < 3) {
      newErrors.platformName = 'Platform name must be at least 3 characters';
    }

    // ✅ MODIFIÉ : Valider account_name seulement si NOT cash
    if (!formData.isCashPayment) {
      if (!formData.accountName.trim()) {
        newErrors.accountName =
          'Account name is required for electronic platforms';
      } else if (formData.accountName.trim().length < 3) {
        newErrors.accountName = 'Account name must be at least 3 characters';
      }

      if (!formData.accountNumber.trim()) {
        newErrors.accountNumber =
          'Account number is required for electronic platforms';
      } else if (formData.accountNumber.trim().length < 3) {
        newErrors.accountNumber =
          'Account number must be at least 3 characters';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      trackValidation(
        'edit_platform_validation_failed',
        {
          errors: Object.keys(errors),
        },
        'warning',
      );
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccessMessage('');

    trackForm('edit_platform_submit_started', {
      platformId: platform.platform_id,
      isCashPayment: formData.isCashPayment,
    });

    try {
      const response = await fetch(
        `/api/dashboard/platforms/${platform.platform_id}/edit`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platformName: formData.platformName.trim(),
            accountName: formData.isCashPayment
              ? null
              : formData.accountName.trim(),
            accountNumber: formData.isCashPayment
              ? null
              : formData.accountNumber.trim(),
            isCashPayment: formData.isCashPayment, // ✅ NOUVEAU
            description: formData.description.trim() || null, // ✅ NOUVEAU
            isActive: formData.isActive,
          }),
        },
      );

      const data = await response.json();

      if (data.success || response.status === 200) {
        setSuccessMessage('Platform updated successfully!');
        setHasChanges(false);

        trackForm('edit_platform_successful', {
          platformId: platform.platform_id,
        });

        setTimeout(() => {
          router.push('/dashboard/platforms');
        }, 2000);
      } else if (data.errors) {
        setErrors(data.errors);
        trackValidation(
          'edit_platform_validation_failed',
          {
            errors: Object.keys(data.errors),
          },
          'warning',
        );
      } else {
        setErrors({ general: data.error || 'Failed to update platform' });
        trackDatabaseError(
          new Error(data.error || 'Update failed'),
          'edit_platform_failed',
          { platformId: platform.platform_id },
        );
      }
    } catch (error) {
      setErrors({ general: 'Failed to update platform. Please try again.' });
      trackDatabaseError(error, 'edit_platform_error', {
        platformId: platform.platform_id,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (
        confirm('You have unsaved changes. Are you sure you want to cancel?')
      ) {
        router.push('/dashboard/platforms');
      }
    } else {
      router.push('/dashboard/platforms');
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all changes?')) {
      setFormData({
        platformName: platform.platform_name || '',
        accountName: platform.account_name || '',
        accountNumber: platform.account_number || '',
        isCashPayment: platform.is_cash_payment || false,
        description: platform.description || '',
        isActive: platform.is_active !== undefined ? platform.is_active : true,
      });
      setErrors({});
      setSuccessMessage('');
      setHasChanges(false);
    }
  };

  if (!platform) {
    return (
      <div className={styles.container}>
        <div className={styles.errorMessage}>
          <MdInfo />
          Platform not found.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <MdEdit className={styles.titleIcon} />
          <h1>Edit Platform</h1>
        </div>
        <div className={styles.platformInfo}>
          <span className={styles.platformId}>ID: {platform.platform_id}</span>
          {/* ✅ NOUVEAU : Badge CASH */}
          {platform.is_cash_payment && (
            <span className={styles.cashBadge}>💵 CASH</span>
          )}
          <span
            className={`${styles.statusBadge} ${platform.is_active ? styles.active : styles.inactive}`}
          >
            {platform.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {successMessage && (
        <div className={styles.successMessage}>{successMessage}</div>
      )}

      {errors.general && (
        <div className={styles.errorMessage}>{errors.general}</div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* ✅ NOUVEAU : Checkbox Cash Payment */}
        <div className={styles.formGroup}>
          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="isCashPayment"
              name="isCashPayment"
              checked={formData.isCashPayment}
              onChange={handleCashPaymentChange}
              className={styles.checkbox}
              disabled={loading}
            />
            <label htmlFor="isCashPayment" className={styles.checkboxLabel}>
              Cash Payment (no account information required)
            </label>
          </div>
          <span className={styles.inputHint}>
            Enable this for cash-on-delivery payments
          </span>
        </div>

        {/* ✅ NOUVEAU : Info box si CASH */}
        {formData.isCashPayment && (
          <div className={styles.infoBox}>
            <span className={styles.infoIcon}>ℹ️</span>
            <span>
              Cash payment selected. Account name and number are not required.
            </span>
          </div>
        )}

        <div className={styles.formGroup}>
          <label htmlFor="platformName" className={styles.label}>
            Platform Name *
          </label>
          <input
            type="text"
            id="platformName"
            name="platformName"
            value={formData.platformName}
            onChange={handleInputChange}
            className={`${styles.input} ${errors.platformName ? styles.inputError : ''}`}
            placeholder="e.g., Orange Money, CASH"
            disabled={loading}
          />
          {errors.platformName && (
            <span className={styles.fieldError}>{errors.platformName}</span>
          )}
        </div>

        {/* ✅ MODIFIÉ : Désactiver si CASH */}
        <div className={styles.formGroup}>
          <label htmlFor="accountName" className={styles.label}>
            Account Name {!formData.isCashPayment && '*'}
          </label>
          <input
            type="text"
            id="accountName"
            name="accountName"
            value={formData.accountName}
            onChange={handleInputChange}
            className={`${styles.input} ${errors.accountName ? styles.inputError : ''} ${formData.isCashPayment ? styles.disabledInput : ''}`}
            placeholder="e.g., BENEW SARL"
            disabled={loading || formData.isCashPayment}
          />
          {errors.accountName && (
            <span className={styles.fieldError}>{errors.accountName}</span>
          )}
          <span className={styles.inputHint}>
            Name of the account receiving electronic payments
          </span>
        </div>

        {/* ✅ MODIFIÉ : Désactiver si CASH */}
        <div className={styles.formGroup}>
          <label htmlFor="accountNumber" className={styles.label}>
            Account Number {!formData.isCashPayment && '*'}
          </label>
          <input
            type="text"
            id="accountNumber"
            name="accountNumber"
            value={formData.accountNumber}
            onChange={handleInputChange}
            className={`${styles.input} ${errors.accountNumber ? styles.inputError : ''} ${formData.isCashPayment ? styles.disabledInput : ''}`}
            placeholder="e.g., 77123456"
            disabled={loading || formData.isCashPayment}
          />
          {errors.accountNumber && (
            <span className={styles.fieldError}>{errors.accountNumber}</span>
          )}
          <span className={styles.inputHint}>
            Phone number or alphanumeric code
          </span>
        </div>

        {/* ✅ NOUVEAU : Champ Description */}
        <div className={styles.formGroup}>
          <label htmlFor="description" className={styles.label}>
            Description (optional)
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            className={styles.textarea}
            placeholder="Additional information about this platform"
            disabled={loading}
            rows="3"
          />
          <span className={styles.inputHint}>
            Optional description or notes
          </span>
        </div>

        <div className={styles.formGroup}>
          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
              className={styles.checkbox}
              disabled={loading}
            />
            <label htmlFor="isActive" className={styles.checkboxLabel}>
              Platform is active
            </label>
          </div>
          <span className={styles.inputHint}>
            Inactive platforms will not be available for transactions
          </span>
        </div>

        <div className={styles.platformDetails}>
          <h3>Platform Information</h3>
          <div className={styles.detailsGrid}>
            {/* ✅ NOUVEAU : Afficher type */}
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Type:</span>
              <span className={styles.detailValue}>
                {platform.is_cash_payment
                  ? '💵 Cash Payment'
                  : '💳 Electronic Platform'}
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Created:</span>
              <span className={styles.detailValue}>
                {new Date(platform.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            {platform.updated_at && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Last Updated:</span>
                <span className={styles.detailValue}>
                  {new Date(platform.updated_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.buttonGroup}>
          <button
            type="submit"
            disabled={loading || !hasChanges}
            className={`${styles.button} ${styles.saveButton}`}
          >
            <MdSave />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={loading || !hasChanges}
            className={`${styles.button} ${styles.resetButton}`}
          >
            Reset
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className={`${styles.button} ${styles.cancelButton}`}
          >
            <MdCancel />
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditPlatform;
