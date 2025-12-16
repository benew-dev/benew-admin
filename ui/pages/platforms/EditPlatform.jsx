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
        isActive: platform.is_active !== undefined ? platform.is_active : true,
      });
    }
  }, [platform]);

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

    if (!formData.accountName.trim()) {
      newErrors.accountName = 'Account name is required';
    } else if (formData.accountName.trim().length < 3) {
      newErrors.accountName = 'Account name must be at least 3 characters';
    }

    if (!formData.accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
    } else if (formData.accountNumber.trim().length < 3) {
      newErrors.accountNumber = 'Account number must be at least 3 characters';
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
    });

    try {
      const response = await fetch(
        `/api/dashboard/platforms/${platform.platform_id}/edit`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platformName: formData.platformName.trim(),
            accountName: formData.accountName.trim(),
            accountNumber: formData.accountNumber.trim(),
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
            placeholder="e.g., Orange Money"
            disabled={loading}
          />
          {errors.platformName && (
            <span className={styles.fieldError}>{errors.platformName}</span>
          )}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="accountName" className={styles.label}>
            Account Name *
          </label>
          <input
            type="text"
            id="accountName"
            name="accountName"
            value={formData.accountName}
            onChange={handleInputChange}
            className={`${styles.input} ${errors.accountName ? styles.inputError : ''}`}
            placeholder="e.g., BENEW SARL"
            disabled={loading}
          />
          {errors.accountName && (
            <span className={styles.fieldError}>{errors.accountName}</span>
          )}
          <span className={styles.inputHint}>
            Name of the account receiving electronic payments
          </span>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="accountNumber" className={styles.label}>
            Account Number *
          </label>
          <input
            type="text"
            id="accountNumber"
            name="accountNumber"
            value={formData.accountNumber}
            onChange={handleInputChange}
            className={`${styles.input} ${errors.accountNumber ? styles.inputError : ''}`}
            placeholder="e.g., 77123456"
            disabled={loading}
          />
          {errors.accountNumber && (
            <span className={styles.fieldError}>{errors.accountNumber}</span>
          )}
          <span className={styles.inputHint}>
            Phone number or alphanumeric code
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
