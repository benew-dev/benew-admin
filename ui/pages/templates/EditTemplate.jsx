// ui/pages/templates/EditTemplate.jsx - CLIENT COMPONENT
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import styles from '@/ui/styling/dashboard/templates/editTemplate.module.css';
import {
  trackUI,
  trackUpload,
  trackUploadError,
  trackForm,
} from '@/utils/monitoring';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export default function EditTemplate({ template }) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    templateName: template.template_name || '',
    templateHasWeb: template.template_has_web ?? true,
    templateHasMobile: template.template_has_mobile ?? false,
    isActive: template.is_active ?? false,
  });
  const [existingImages, setExistingImages] = useState(
    template.template_images || [],
  );
  const [newFiles, setNewFiles] = useState([]);
  const [newPreviews, setNewPreviews] = useState([]);
  const [newImageIds, setNewImageIds] = useState([]);
  const [errors, setErrors] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track component mount
  useEffect(() => {
    trackUI('edit_template_form_mounted', {
      templateId: template.template_id,
    });
  }, [template.template_id]);

  // ===== FILE VALIDATION =====
  const validateFile = useCallback((file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `${file.name}: Invalid file type. Only JPEG, PNG, and WebP allowed.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: File too large. Max size is 5MB.`;
    }
    return null;
  }, []);

  // ===== FILE SELECTION =====
  const handleFileSelect = useCallback(
    (e) => {
      const files = Array.from(e.target.files || []);
      const totalImages =
        existingImages.length + newFiles.length + files.length;

      trackUI('file_selection_started', {
        filesCount: files.length,
        currentTotal: existingImages.length + newFiles.length,
      });

      if (totalImages > MAX_FILES) {
        setErrors((prev) => ({
          ...prev,
          files: `Maximum ${MAX_FILES} images allowed. You currently have ${existingImages.length + newFiles.length}.`,
        }));
        trackUI(
          'file_selection_limit_exceeded',
          {
            attempted: files.length,
            currentTotal: existingImages.length + newFiles.length,
          },
          'warning',
        );
        return;
      }

      const validationErrors = [];
      const validFiles = [];

      files.forEach((file) => {
        const error = validateFile(file);
        if (error) {
          validationErrors.push(error);
        } else {
          validFiles.push(file);
        }
      });

      if (validationErrors.length > 0) {
        setErrors((prev) => ({
          ...prev,
          files: validationErrors.join(' | '),
        }));
        trackUI(
          'file_validation_failed',
          {
            errorsCount: validationErrors.length,
          },
          'warning',
        );
        return;
      }

      const newPreviewsArray = validFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }));

      setNewFiles((prev) => [...prev, ...validFiles]);
      setNewPreviews((prev) => [...prev, ...newPreviewsArray]);
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.files;
        return newErrors;
      });

      trackUI('files_selected_successfully', {
        filesCount: validFiles.length,
      });

      e.target.value = '';
    },
    [existingImages.length, newFiles.length, validateFile],
  );

  // ===== REMOVE EXISTING IMAGE =====
  const handleRemoveExistingImage = useCallback((index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
    trackUI('existing_image_removed', { index });
  }, []);

  // ===== REMOVE NEW IMAGE =====
  const handleRemoveNewImage = useCallback((index) => {
    setNewPreviews((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
    setNewImageIds((prev) => prev.filter((_, i) => i !== index));
    trackUI('new_image_removed', { index });
  }, []);

  // ===== UPLOAD TO CLOUDINARY =====
  const uploadToCloudinary = useCallback(async (file) => {
    trackUpload('cloudinary_upload_started', {
      fileName: file.name,
      fileSize: file.size,
    });

    try {
      // ✅ FIX: Générer le timestamp UNE SEULE FOIS
      const timestamp = Math.round(Date.now() / 1000);

      const signatureResponse = await fetch(
        '/api/dashboard/templates/add/sign-image',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paramsToSign: {
              timestamp: timestamp, // ✅ Utiliser le même timestamp
              folder: 'templates',
            },
          }),
        },
      );

      if (!signatureResponse.ok) {
        const errorData = await signatureResponse.json();
        console.error('Signature response error:', errorData);
        throw new Error(
          `Failed to get upload signature: ${signatureResponse.status}`,
        );
      }

      const { signature } = await signatureResponse.json();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY);
      formData.append('signature', signature);
      formData.append('timestamp', timestamp.toString()); // ✅ Réutiliser LE MÊME timestamp
      formData.append('folder', 'templates');

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload response error:', errorText);
        throw new Error(
          `Cloudinary upload failed: ${uploadResponse.status} - ${errorText}`,
        );
      }

      const result = await uploadResponse.json();

      trackUpload('cloudinary_upload_successful', {
        publicId: result.public_id,
      });

      return result.public_id;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      trackUploadError(error, 'cloudinary_upload', {
        fileName: file.name,
      });
      throw error;
    }
  }, []);

  // ===== UPLOAD NEW IMAGES =====
  const handleUploadNewImages = useCallback(async () => {
    if (newFiles.length === 0) return true;

    setIsUploading(true);

    trackUpload('batch_upload_started', {
      filesCount: newFiles.length,
    });

    try {
      const uploadPromises = newFiles.map((file) => uploadToCloudinary(file));
      const imageIds = await Promise.all(uploadPromises);
      setNewImageIds(imageIds);

      trackUpload('batch_upload_successful', {
        filesCount: imageIds.length,
      });

      return true;
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        files: 'Failed to upload new images. Please try again.',
      }));
      trackUploadError(error, 'batch_upload');
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [newFiles, uploadToCloudinary]);

  // ===== FORM SUBMISSION =====
  const handleSubmit = async (e) => {
    e.preventDefault();

    trackForm('edit_template_submit_started', {
      templateId: template.template_id,
    });

    // Upload new images if any
    if (newFiles.length > 0 && newImageIds.length === 0) {
      const uploadSuccess = await handleUploadNewImages();
      if (!uploadSuccess) return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const sanitizedName = formData.templateName.trim();
      const allImageIds = [...existingImages, ...newImageIds];

      const response = await fetch(
        `/api/dashboard/templates/${template.template_id}/edit`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateName: sanitizedName,
            templateImageIds: allImageIds,
            templateHasWeb: formData.templateHasWeb,
            templateHasMobile: formData.templateHasMobile,
            isActive: formData.isActive,
            oldImageIds: template.template_images || [],
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          setErrors(data.errors);
          trackForm(
            'edit_template_validation_failed',
            {
              templateId: template.template_id,
              errors: Object.keys(data.errors),
            },
            'warning',
          );
        } else {
          setErrors({ submit: data.error || 'Failed to update template' });
          trackForm(
            'edit_template_failed',
            {
              templateId: template.template_id,
              status: response.status,
            },
            'error',
          );
        }
        setIsSubmitting(false);
        return;
      }

      trackForm('edit_template_successful', {
        templateId: template.template_id,
      });

      // Cleanup previews
      newPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));

      // Redirect
      router.push('/dashboard/templates?edited=true');
    } catch (error) {
      console.error('Submit error:', error);
      trackUploadError(error, 'template_update');
      setErrors({ submit: 'An unexpected error occurred' });
      setIsSubmitting(false);
    }
  };

  // ===== INPUT CHANGE =====
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const isLoading = isUploading || isSubmitting;
  const totalImages = existingImages.length + newFiles.length;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Edit Template</h1>

      {/* Template Info */}
      <div className={styles.templateInfo}>
        <h2 className={styles.infoTitle}>Template Information</h2>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Template ID</div>
            <div className={styles.infoValue}>{template.template_id}</div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Created At</div>
            <div className={styles.infoValue}>
              {new Date(template.template_added).toLocaleDateString()}
            </div>
          </div>
          {template.sales_count > 0 && (
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Sales Count</div>
              <div className={styles.salesCount}>{template.sales_count}</div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Template Name */}
        <div className={styles.formGroup}>
          <label htmlFor="templateName">Template Name *</label>
          <input
            id="templateName"
            name="templateName"
            type="text"
            value={formData.templateName}
            onChange={handleInputChange}
            disabled={isLoading}
            className={`${styles.input} ${errors.templateName ? styles.inputError : ''}`}
            aria-invalid={!!errors.templateName}
            aria-describedby={
              errors.templateName ? 'templateName-error' : undefined
            }
          />
          {errors.templateName && (
            <div
              id="templateName-error"
              className={styles.fieldError}
              role="alert"
            >
              {errors.templateName}
            </div>
          )}
        </div>

        {/* Existing Images */}
        {existingImages.length > 0 && (
          <div className={styles.formGroup}>
            <label>Current Images</label>
            <div className={styles.imagesGrid}>
              {existingImages.map((imageId, index) => (
                <div key={imageId} className={styles.imagePreview}>
                  <Image
                    src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/${imageId}`}
                    alt={`Existing ${index + 1}`}
                    width={200}
                    height={200}
                    style={{ objectFit: 'cover', borderRadius: '5px' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveExistingImage(index)}
                    disabled={isLoading}
                    className={styles.removeImageButton}
                    aria-label={`Remove existing image ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Images */}
        <div className={styles.formGroup}>
          <label htmlFor="images">
            Add New Images (Max {MAX_FILES} total, currently {totalImages})
          </label>
          <div className={styles.imageUpload}>
            <input
              id="images"
              type="file"
              multiple
              accept={ALLOWED_TYPES.join(',')}
              onChange={handleFileSelect}
              disabled={isLoading || totalImages >= MAX_FILES}
              className={`${styles.uploadButton} ${errors.files ? styles.uploadButtonError : ''}`}
              aria-describedby={errors.files ? 'files-error' : undefined}
            />
            {errors.files && (
              <div id="files-error" className={styles.fieldError} role="alert">
                {errors.files}
              </div>
            )}
          </div>
        </div>

        {/* New Image Previews */}
        {newPreviews.length > 0 && (
          <div className={styles.formGroup}>
            <label>New Images to Upload</label>
            <div className={styles.imagesGrid}>
              {newPreviews.map((preview, index) => (
                <div key={index} className={styles.imagePreview}>
                  <Image
                    src={preview.url}
                    alt={`New preview ${index + 1}`}
                    width={200}
                    height={200}
                    style={{ objectFit: 'cover', borderRadius: '5px' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveNewImage(index)}
                    disabled={isLoading}
                    className={styles.removeImageButton}
                    aria-label={`Remove new image ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platform Checkboxes */}
        <div className={styles.formGroup}>
          <label>Platforms</label>
          <div className={styles.checkboxGroup}>
            <div className={styles.checkbox}>
              <input
                type="checkbox"
                id="templateHasWeb"
                name="templateHasWeb"
                checked={formData.templateHasWeb}
                onChange={handleInputChange}
                disabled={isLoading}
              />
              <label htmlFor="templateHasWeb">Web</label>
            </div>
            <div className={styles.checkbox}>
              <input
                type="checkbox"
                id="templateHasMobile"
                name="templateHasMobile"
                checked={formData.templateHasMobile}
                onChange={handleInputChange}
                disabled={isLoading}
              />
              <label htmlFor="templateHasMobile">Mobile</label>
            </div>
          </div>
        </div>

        {/* Active Status */}
        <div className={styles.statusSection}>
          <div className={styles.statusCheckbox}>
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
              disabled={isLoading}
              className={styles.statusInput}
            />
            <label
              htmlFor="isActive"
              className={`${styles.statusLabel} ${formData.isActive ? styles.activeLabel : styles.inactiveLabel}`}
            >
              <span
                className={`${styles.statusIndicator} ${formData.isActive ? styles.activeIndicator : styles.inactiveIndicator}`}
              />
              {formData.isActive ? 'Active Template' : 'Inactive Template'}
            </label>
          </div>
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className={styles.error} role="alert">
            {errors.submit}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || totalImages === 0}
          className={styles.submitButton}
          aria-busy={isLoading}
        >
          {isUploading
            ? 'Uploading...'
            : isSubmitting
              ? 'Saving...'
              : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
