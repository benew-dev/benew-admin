'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CldUploadWidget, CldImage } from 'next-cloudinary';
import * as Sentry from '@sentry/nextjs';
import { templateUpdateSchema } from '@/utils/schemas/templateSchema';
import styles from '@/ui/styling/dashboard/templates/editTemplate.module.css';

export default function EditTemplate({ template }) {
  const [templateName, setTemplateName] = useState(template.template_name);
  const [hasWeb, setHasWeb] = useState(template.template_has_web);
  const [hasMobile, setHasMobile] = useState(template.template_has_mobile);
  const [isActive, setIsActive] = useState(template.is_active);
  const [imageIds, setImageIds] = useState(template.template_images || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const router = useRouter();

  const handleUploadSuccess = (result) => {
    const uploadInfo = result.info;
    setImageIds((prev) => [...prev, uploadInfo.public_id]);
    setSuccess('Image added!');
    setTimeout(() => setSuccess(''), 3000);
    if (validationErrors.templateImageIds) {
      setValidationErrors((prev) => ({ ...prev, templateImageIds: '' }));
    }
    Sentry.addBreadcrumb({
      category: 'upload',
      message: 'Image added',
      level: 'info',
      data: { publicId: uploadInfo.public_id },
    });
  };

  const handleUploadError = (error) => {
    setError('Failed to upload image.');
    console.error('Upload error:', error);
    Sentry.captureException(error, {
      tags: { component: 'edit_template_form', action: 'image_upload' },
    });
  };

  const handleRemoveImage = (indexToRemove) => {
    setImageIds((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const clearFieldError = (fieldName) => {
    if (validationErrors[fieldName]) {
      setValidationErrors((prev) => ({ ...prev, [fieldName]: '' }));
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setValidationErrors({});

    const formData = {
      templateName,
      templateImageIds: imageIds,
      templateHasWeb: hasWeb,
      templateHasMobile: hasMobile,
      isActive: isActive,
    };

    try {
      await templateUpdateSchema.validate(formData, { abortEarly: false });
      setIsLoading(true);

      const response = await fetch(
        `/api/dashboard/templates/${template.template_id}/edit`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateName,
            templateImageIds: imageIds,
            templateHasWeb: hasWeb,
            templateHasMobile: hasMobile,
            isActive: isActive,
            oldImageIds: template.template_images,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        if (result.errors && typeof result.errors === 'object') {
          setValidationErrors(result.errors);
          setError('Please correct the errors below');
          return;
        }
        throw new Error(result.message || 'Failed to update template');
      }

      setSuccess('Template updated!');
      Sentry.addBreadcrumb({
        category: 'form',
        message: 'Template updated',
        level: 'info',
        data: { templateId: template.template_id },
      });

      setTimeout(() => {
        router.push('/dashboard/templates');
        router.refresh();
      }, 1500);
    } catch (validationError) {
      if (validationError.name === 'ValidationError') {
        const newErrors = {};
        validationError.inner.forEach((error) => {
          newErrors[error.path] = error.message;
        });
        setValidationErrors(newErrors);
        setError('Please correct the errors below');
      } else {
        setError(validationError.message || 'An error occurred');
        Sentry.captureException(validationError, {
          tags: { component: 'edit_template_form', action: 'submit' },
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Edit Template</h1>

      <div className={styles.templateInfo}>
        <h3 className={styles.infoTitle}>Template Information</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Template ID:</span>
            <span className={styles.infoValue}>{template.template_id}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Sales Count:</span>
            <span className={styles.salesCount}>{template.sales_count}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Created:</span>
            <span className={styles.infoValue}>
              {formatDate(template.template_added)}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Last Updated:</span>
            <span className={styles.infoValue}>
              {formatDate(template.updated_at)}
            </span>
          </div>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <div className={styles.formGroup}>
          <label htmlFor="templateName">Template Name</label>
          <input
            type="text"
            id="templateName"
            value={templateName}
            onChange={(e) => {
              setTemplateName(e.target.value);
              clearFieldError('templateName');
            }}
            className={`${styles.input} ${validationErrors.templateName ? styles.inputError : ''}`}
            required
          />
          {validationErrors.templateName && (
            <div className={styles.fieldError}>
              {validationErrors.templateName}
            </div>
          )}
        </div>

        <div className={styles.statusSection}>
          <div className={styles.checkboxGroup}>
            <div className={styles.checkbox}>
              <input
                type="checkbox"
                id="hasWeb"
                checked={hasWeb}
                onChange={(e) => {
                  setHasWeb(e.target.checked);
                  clearFieldError('templateHasWeb');
                  clearFieldError('templateHasMobile');
                }}
              />
              <label htmlFor="hasWeb">Web</label>
            </div>
            <div className={styles.checkbox}>
              <input
                type="checkbox"
                id="hasMobile"
                checked={hasMobile}
                onChange={(e) => {
                  setHasMobile(e.target.checked);
                  clearFieldError('templateHasWeb');
                  clearFieldError('templateHasMobile');
                }}
              />
              <label htmlFor="hasMobile">Mobile</label>
            </div>
            <div className={`${styles.checkbox} ${styles.statusCheckbox}`}>
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => {
                  setIsActive(e.target.checked);
                  clearFieldError('isActive');
                }}
                className={styles.statusInput}
              />
              <label
                htmlFor="isActive"
                className={`${styles.statusLabel} ${isActive ? styles.activeLabel : styles.inactiveLabel}`}
              >
                <span
                  className={`${styles.statusIndicator} ${isActive ? styles.activeIndicator : styles.inactiveIndicator}`}
                ></span>
                {isActive ? 'Active' : 'Inactive'}
              </label>
            </div>
          </div>
          {(validationErrors.templateHasWeb ||
            validationErrors.templateHasMobile) && (
            <div className={styles.fieldError}>
              Template must be available for at least one platform
            </div>
          )}
          {validationErrors.isActive && (
            <div className={styles.fieldError}>{validationErrors.isActive}</div>
          )}
        </div>

        <div className={styles.imageUpload}>
          <CldUploadWidget
            options={{
              sources: ['local', 'url', 'camera'],
              multiple: false,
              folder: 'templates',
              clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
              maxImageFileSize: 5000000,
            }}
            signatureEndpoint="/api/dashboard/templates/add/sign-image"
            onSuccess={handleUploadSuccess}
            onError={handleUploadError}
          >
            {({ open }) => (
              <button
                type="button"
                className={`${styles.uploadButton} ${validationErrors.templateImageIds ? styles.uploadButtonError : ''}`}
                onClick={() => open()}
                disabled={imageIds.length >= 10}
              >
                Add Image ({imageIds.length}/10)
              </button>
            )}
          </CldUploadWidget>

          {validationErrors.templateImageIds && (
            <div className={styles.fieldError}>
              {validationErrors.templateImageIds}
            </div>
          )}

          {imageIds.length > 0 && (
            <div className={styles.imagesGrid}>
              {imageIds.map((imageId, index) => (
                <div key={index} className={styles.imagePreview}>
                  <CldImage
                    width="200"
                    height="130"
                    src={imageId}
                    alt={`Image ${index + 1}`}
                    crop="fill"
                    gravity="auto"
                  />
                  <button
                    type="button"
                    className={styles.removeImageButton}
                    onClick={() => handleRemoveImage(index)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          className={styles.submitButton}
          disabled={isLoading}
        >
          {isLoading ? 'Updating...' : 'Update Template'}
        </button>
      </form>
    </div>
  );
}
