'use client';

// ui/pages/templates/AddTemplateForm.jsx
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
  const [publicId, setPublicId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const router = useRouter();

  // ===== UPLOAD HANDLERS =====

  const handleUploadSuccess = (result) => {
    const uploadInfo = result.info;
    setPublicId(uploadInfo.public_id);
    setSuccess('Image uploaded successfully!');
    setTimeout(() => setSuccess(''), 3000);

    // Clear validation error
    if (validationErrors.templateImageId) {
      setValidationErrors((prev) => ({
        ...prev,
        templateImageId: '',
      }));
    }

    Sentry.addBreadcrumb({
      category: 'upload',
      message: 'Template image uploaded',
      level: 'info',
      data: { publicId: uploadInfo.public_id },
    });
  };

  const handleUploadError = (error) => {
    setError('Failed to upload image. Please try again.');
    console.error('Upload error:', error);

    Sentry.captureException(error, {
      tags: { component: 'add_template_form', action: 'image_upload' },
    });
  };

  // ===== FORM HANDLERS =====

  const clearFieldError = (fieldName) => {
    if (validationErrors[fieldName]) {
      setValidationErrors((prev) => ({
        ...prev,
        [fieldName]: '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setValidationErrors({});

    const formData = {
      templateName,
      templateImageId: publicId,
      templateHasWeb: hasWeb,
      templateHasMobile: hasMobile,
    };

    try {
      // 1. Sanitization
      const sanitizedData = sanitizeTemplateInputs(formData);

      // 2. Validation Yup (côté client)
      await templateAddingSchema.validate(sanitizedData, { abortEarly: false });

      // 3. Envoi API
      setIsLoading(true);

      const response = await fetch('/api/dashboard/templates/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedData),
      });

      const result = await response.json();

      if (!response.ok) {
        // Erreurs de validation serveur
        if (result.errors) {
          setValidationErrors(result.errors);
          setError('Please correct the errors below');
        } else {
          throw new Error(result.message || 'Failed to add template');
        }
        return;
      }

      // Succès
      setSuccess('Template added successfully!');

      Sentry.addBreadcrumb({
        category: 'form',
        message: 'Template added successfully',
        level: 'info',
        data: { templateId: result.templateId },
      });

      // Reset form
      setTemplateName('');
      setHasWeb(true);
      setHasMobile(false);
      setPublicId('');
      setValidationErrors({});

      // Redirect
      setTimeout(() => {
        router.push('/dashboard/templates');
        router.refresh();
      }, 1500);
    } catch (validationError) {
      if (validationError.name === 'ValidationError') {
        // Erreurs Yup
        const newErrors = {};
        validationError.inner.forEach((error) => {
          newErrors[error.path] = error.message;
        });
        setValidationErrors(newErrors);
        setError('Please correct the errors below');

        Sentry.addBreadcrumb({
          category: 'validation',
          message: 'Form validation failed',
          level: 'warning',
          data: { errors: Object.keys(newErrors) },
        });
      } else {
        // Autres erreurs
        setError(validationError.message || 'An error occurred');

        Sentry.captureException(validationError, {
          tags: { component: 'add_template_form', action: 'submit' },
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ===== RENDER =====

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Add New Template</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Messages */}
        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        {/* Template Name */}
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
            className={`${styles.input} ${
              validationErrors.templateName ? styles.inputError : ''
            }`}
            required
          />
          {validationErrors.templateName && (
            <div className={styles.fieldError}>
              {validationErrors.templateName}
            </div>
          )}
        </div>

        {/* Platforms */}
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

        {/* Platform validation error */}
        {(validationErrors.templateHasWeb ||
          validationErrors.templateHasMobile) && (
          <div className={styles.fieldError}>
            Template must be available for at least one platform (Web or Mobile)
          </div>
        )}

        {/* Image Upload */}
        <div className={styles.imageUpload}>
          <CldUploadWidget
            options={{
              sources: ['local', 'url', 'camera'],
              multiple: false,
              folder: 'templates',
              clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
              maxImageFileSize: 5000000, // 5MB
            }}
            signatureEndpoint="/api/dashboard/templates/add/sign-image"
            onSuccess={handleUploadSuccess}
            onError={handleUploadError}
          >
            {({ open }) => (
              <button
                type="button"
                className={`${styles.uploadButton} ${
                  validationErrors.templateImageId
                    ? styles.uploadButtonError
                    : ''
                }`}
                onClick={() => open()}
              >
                Upload Template Image
              </button>
            )}
          </CldUploadWidget>

          {validationErrors.templateImageId && (
            <div className={styles.fieldError}>
              {validationErrors.templateImageId}
            </div>
          )}

          {/* Image Preview */}
          {publicId && (
            <div className={styles.imagePreview}>
              <CldImage
                width="300"
                height="200"
                src={publicId}
                alt="Template Preview"
                crop="fill"
                gravity="auto"
                sizes="(max-width: 768px) 100vw, 300px"
              />
            </div>
          )}
        </div>

        {/* Submit Button */}
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
