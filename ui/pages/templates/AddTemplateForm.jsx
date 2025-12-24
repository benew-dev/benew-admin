// ui/pages/templates/AddTemplateForm.jsx - CLIENT COMPONENT
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import styles from '@/ui/styling/dashboard/templates/addTemplate.module.css';
import {
  trackUI,
  trackUpload,
  trackUploadError,
  trackForm,
} from '@/utils/monitoring';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export default function AddTemplateForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    templateName: '',
    templateHasWeb: true,
    templateHasMobile: false,
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploadedImageIds, setUploadedImageIds] = useState([]);
  const [errors, setErrors] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      trackUI('file_selection_started', {
        filesCount: files.length,
      });

      // Validate total count
      if (selectedFiles.length + files.length > MAX_FILES) {
        setErrors((prev) => ({
          ...prev,
          files: `Maximum ${MAX_FILES} images allowed. You have ${selectedFiles.length} selected.`,
        }));
        trackUI(
          'file_selection_limit_exceeded',
          {
            attempted: files.length,
            current: selectedFiles.length,
          },
          'warning',
        );
        return;
      }

      // Validate each file
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

      // Create previews
      const newPreviews = validFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }));

      setSelectedFiles((prev) => [...prev, ...validFiles]);
      setPreviews((prev) => [...prev, ...newPreviews]);
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.files;
        return newErrors;
      });

      trackUI('files_selected_successfully', {
        filesCount: validFiles.length,
      });

      // Clear input
      e.target.value = '';
    },
    [selectedFiles.length, validateFile],
  );

  // ===== REMOVE IMAGE =====
  const handleRemoveImage = useCallback((index) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadedImageIds((prev) => prev.filter((_, i) => i !== index));

    trackUI('image_removed', { index });
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

      // 1. Get signature
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

      // 2. Upload to Cloudinary
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

  // ===== UPLOAD ALL IMAGES =====
  const handleUploadImages = useCallback(async () => {
    if (selectedFiles.length === 0) {
      setErrors((prev) => ({
        ...prev,
        files: 'Please select at least one image',
      }));
      return false;
    }

    setIsUploading(true);
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.files;
      return newErrors;
    });

    trackUpload('batch_upload_started', {
      filesCount: selectedFiles.length,
    });

    try {
      const uploadPromises = selectedFiles.map((file) =>
        uploadToCloudinary(file),
      );
      const imageIds = await Promise.all(uploadPromises);
      setUploadedImageIds(imageIds);

      trackUpload('batch_upload_successful', {
        filesCount: imageIds.length,
      });

      return true;
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        files: 'Failed to upload images. Please try again.',
      }));
      trackUploadError(error, 'batch_upload');
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [selectedFiles, uploadToCloudinary]);

  // ===== FORM SUBMISSION =====
  const handleSubmit = async (e) => {
    e.preventDefault();

    trackForm('add_template_submit_started');

    // Upload images first if not already uploaded
    if (uploadedImageIds.length === 0) {
      const uploadSuccess = await handleUploadImages();
      if (!uploadSuccess) return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const sanitizedName = formData.templateName.trim();

      const response = await fetch('/api/dashboard/templates/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: sanitizedName,
          templateImageIds: uploadedImageIds,
          templateHasWeb: formData.templateHasWeb,
          templateHasMobile: formData.templateHasMobile,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          setErrors(data.errors);
          trackForm(
            'add_template_validation_failed',
            {
              errors: Object.keys(data.errors),
            },
            'warning',
          );
        } else {
          setErrors({ submit: data.error || 'Failed to add template' });
          trackForm(
            'add_template_failed',
            {
              status: response.status,
            },
            'error',
          );
        }
        setIsSubmitting(false);
        return;
      }

      trackForm('add_template_successful', {
        templateId: data.templateId,
      });

      // Cleanup previews
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));

      // Redirect
      router.push('/dashboard/templates?added=true');
    } catch (error) {
      console.error('Submit error:', error);
      trackUploadError(error, 'template_submission');
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

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Add New Template</h1>

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
            placeholder="Summer Collection 2024"
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

        {/* Image Upload */}
        <div className={styles.formGroup}>
          <label htmlFor="images">Images * (Max {MAX_FILES})</label>
          <div className={styles.imageUpload}>
            <input
              id="images"
              type="file"
              multiple
              accept={ALLOWED_TYPES.join(',')}
              onChange={handleFileSelect}
              disabled={isLoading || selectedFiles.length >= MAX_FILES}
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

        {/* Image Previews */}
        {previews.length > 0 && (
          <div className={styles.imagesGrid}>
            {previews.map((preview, index) => (
              <div key={index} className={styles.imagePreview}>
                <Image
                  src={preview.url}
                  alt={`Preview ${index + 1}`}
                  width={150}
                  height={150}
                  style={{ objectFit: 'cover', borderRadius: '5px' }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  disabled={isLoading}
                  className={styles.removeImageButton}
                  aria-label={`Remove image ${index + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
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

        {/* Submit Error */}
        {errors.submit && (
          <div className={styles.error} role="alert">
            {errors.submit}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || selectedFiles.length === 0}
          className={styles.submitButton}
          aria-busy={isLoading}
        >
          {isUploading
            ? 'Uploading...'
            : isSubmitting
              ? 'Adding...'
              : 'Add Template'}
        </button>
      </form>
    </div>
  );
}
