// ui/pages/templates/AddTemplateForm.jsx - CLIENT COMPONENT
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import DOMPurify from 'isomorphic-dompurify';
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
      // 1. Get signature
      const signatureResponse = await fetch(
        '/api/dashboard/templates/add/sign-image',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paramsToSign: {
              timestamp: Math.round(Date.now() / 1000),
              folder: 'templates',
            },
          }),
        },
      );

      if (!signatureResponse.ok) {
        throw new Error('Failed to get upload signature');
      }

      const { signature } = await signatureResponse.json();

      // 2. Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY);
      formData.append('signature', signature);
      formData.append('timestamp', Math.round(Date.now() / 1000).toString());
      formData.append('folder', 'templates');

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!uploadResponse.ok) {
        throw new Error('Cloudinary upload failed');
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
      const sanitizedName = DOMPurify.sanitize(formData.templateName.trim());

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
    <form onSubmit={handleSubmit} className="template-form">
      {/* Template Name */}
      <div className="form-group">
        <label htmlFor="templateName">Template Name *</label>
        <input
          id="templateName"
          name="templateName"
          type="text"
          value={formData.templateName}
          onChange={handleInputChange}
          disabled={isLoading}
          placeholder="Summer Collection 2024"
          aria-invalid={!!errors.templateName}
          aria-describedby={
            errors.templateName ? 'templateName-error' : undefined
          }
        />
        {errors.templateName && (
          <div id="templateName-error" className="error" role="alert">
            {errors.templateName}
          </div>
        )}
      </div>

      {/* Image Upload */}
      <div className="form-group">
        <label htmlFor="images">Images * (Max {MAX_FILES})</label>
        <input
          id="images"
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileSelect}
          disabled={isLoading || selectedFiles.length >= MAX_FILES}
          aria-describedby={errors.files ? 'files-error' : undefined}
        />
        {errors.files && (
          <div id="files-error" className="error" role="alert">
            {errors.files}
          </div>
        )}
      </div>

      {/* Image Previews */}
      {previews.length > 0 && (
        <div className="previews">
          {previews.map((preview, index) => (
            <div key={index} className="preview-item">
              <Image
                src={preview.url}
                alt={`Preview ${index + 1}`}
                width={150}
                height={150}
                style={{ objectFit: 'cover' }}
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                disabled={isLoading}
                className="remove-btn"
                aria-label={`Remove image ${index + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Platform Checkboxes */}
      <div className="form-group">
        <label>Platforms</label>
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              name="templateHasWeb"
              checked={formData.templateHasWeb}
              onChange={handleInputChange}
              disabled={isLoading}
            />
            Web
          </label>
          <label>
            <input
              type="checkbox"
              name="templateHasMobile"
              checked={formData.templateHasMobile}
              onChange={handleInputChange}
              disabled={isLoading}
            />
            Mobile
          </label>
        </div>
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="error submit-error" role="alert">
          {errors.submit}
        </div>
      )}

      {/* Action Buttons */}
      <div className="form-actions">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isLoading}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || selectedFiles.length === 0}
          className="btn-primary"
          aria-busy={isLoading}
        >
          {isUploading
            ? 'Uploading...'
            : isSubmitting
              ? 'Adding...'
              : 'Add Template'}
        </button>
      </div>
    </form>
  );
}
