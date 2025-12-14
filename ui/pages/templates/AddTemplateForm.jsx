'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CldUploadWidget, CldImage } from 'next-cloudinary';
import * as Sentry from '@sentry/nextjs';
import { sanitizeTemplateInputs } from '@/utils/sanitizers/sanitizeTemplateInputs';
import { templateAddingSchema } from '@/utils/schemas/templateSchema';
import styles from '@/ui/styling/dashboard/templates/addTemplate.module.css';

export default function AddTemplateForm() {
  const [templateName, setTemplateName] = useState('');
  const [hasWeb, setHasWeb] = useState(true);
  const [hasMobile, setHasMobile] = useState(false);
  const [imageIds, setImageIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const router = useRouter();

  const handleUploadSuccess = (result) => {
    const uploadInfo = result.info;
    setImageIds((prev) => [...prev, uploadInfo.public_id]);
    setSuccess('Image uploaded!');
    setTimeout(() => setSuccess(''), 3000);
    if (validationErrors.templateImageIds) {
      setValidationErrors((prev) => ({ ...prev, templateImageIds: '' }));
    }
    Sentry.addBreadcrumb({
      category: 'upload',
      message: 'Template image uploaded',
      level: 'info',
      data: { publicId: uploadInfo.public_id },
    });
  };

  const handleUploadError = (error) => {
    setError('Failed to upload image.');
    console.error('Upload error:', error);
    Sentry.captureException(error, {
      tags: { component: 'add_template_form', action: 'image_upload' },
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
    };

    try {
      const sanitizedData = sanitizeTemplateInputs(formData);
      await templateAddingSchema.validate(sanitizedData, { abortEarly: false });
      setIsLoading(true);

      const response = await fetch('/api/dashboard/templates/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedData),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.errors) {
          setValidationErrors(result.errors);
          setError('Please correct the errors below');
        } else {
          throw new Error(result.message || 'Failed to add template');
        }
        return;
      }

      setSuccess('Template added successfully!');
      Sentry.addBreadcrumb({
        category: 'form',
        message: 'Template added',
        level: 'info',
        data: { templateId: result.templateId },
      });

      setTemplateName('');
      setHasWeb(true);
      setHasMobile(false);
      setImageIds([]);
      setValidationErrors({});

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
          tags: { component: 'add_template_form', action: 'submit' },
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Add New Template</h1>

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
            placeholder="Enter template name"
            className={`${styles.input} ${validationErrors.templateName ? styles.inputError : ''}`}
            required
          />
          {validationErrors.templateName && (
            <div className={styles.fieldError}>
              {validationErrors.templateName}
            </div>
          )}
        </div>

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
        </div>

        {(validationErrors.templateHasWeb ||
          validationErrors.templateHasMobile) && (
          <div className={styles.fieldError}>
            Template must be available for at least one platform
          </div>
        )}

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
                Upload Image ({imageIds.length}/10)
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
                    width="150"
                    height="100"
                    src={imageId}
                    alt={`Preview ${index + 1}`}
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
          {isLoading ? 'Adding...' : 'Add Template'}
        </button>
      </form>
    </div>
  );
}
