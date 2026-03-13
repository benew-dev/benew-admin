// ui/pages/channel/EditVideo.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CldUploadWidget } from 'next-cloudinary';
import { MdArrowBack, MdInfo, MdCheck, MdClose, MdError } from 'react-icons/md';
import styles from '@/ui/styling/dashboard/channel/edit/editVideo.module.css';
import { videoUpdateSchema } from '@/utils/schemas/videoSchema';
import {
  trackForm,
  trackUpload,
  trackUploadError,
  trackValidation,
  trackNavigation,
} from '@/utils/monitoring';

const CATEGORIES = [
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'overview', label: 'Overview' },
  { value: 'demo', label: 'Demo' },
  { value: 'setup', label: 'Setup' },
  { value: 'tips', label: 'Tips' },
];

export default function EditVideo({ video }) {
  const router = useRouter();

  // Champs éditables
  const [title, setTitle] = useState(video.video_title);
  const [description, setDescription] = useState(video.video_description || '');
  const [category, setCategory] = useState(video.video_category);
  const [level, setLevel] = useState(video.video_level || 1);
  const [tags, setTags] = useState(video.video_tags?.join(', ') || '');
  const [durationSeconds, setDurationSeconds] = useState(
    video.video_duration_seconds || '',
  );
  const [seriesName, setSeriesName] = useState(video.series_name || '');
  const [seriesOrder, setSeriesOrder] = useState(video.series_order || '');
  const [relatedApplicationId, setRelatedApplicationId] = useState(
    video.related_application_id || '',
  );
  const [relatedTemplateId, setRelatedTemplateId] = useState(
    video.related_template_id || '',
  );
  const [isActive, setIsActive] = useState(video.is_active);

  // Assets Cloudinary
  const [cloudinaryId, setCloudinaryId] = useState(video.video_cloudinary_id);
  const [thumbnailId, setThumbnailId] = useState(
    video.video_thumbnail_id || null,
  );

  // Anciens IDs pour suppression côté serveur
  const oldCloudinaryId = video.video_cloudinary_id;
  const oldThumbnailId = video.video_thumbnail_id || null;

  // UI state
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasFieldError = (fieldName) => Boolean(fieldErrors[fieldName]);
  const getFieldError = (fieldName) => fieldErrors[fieldName] || '';

  // Parser les tags : "tag1, tag2, tag3" → ["tag1", "tag2", "tag3"]
  const parseTags = (tagsString) => {
    if (!tagsString?.trim()) return [];
    return tagsString
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    trackForm('edit_video_submit_started', { videoId: video.video_id });

    const parsedTags = parseTags(tags);

    const formData = {
      title,
      description: description || null,
      category,
      level: parseInt(level),
      tags: parsedTags,
      durationSeconds: durationSeconds ? parseInt(durationSeconds) : null,
      seriesName: seriesName || null,
      seriesOrder: seriesOrder ? parseInt(seriesOrder) : null,
      relatedApplicationId: relatedApplicationId || null,
      relatedTemplateId: relatedTemplateId || null,
      isActive,
      cloudinaryId,
      thumbnailId,
      oldCloudinaryId,
      oldThumbnailId,
    };

    try {
      // Validation Yup côté client
      await videoUpdateSchema.validate(
        {
          title,
          description: description || undefined,
          category,
          level: parseInt(level),
          tags: parsedTags,
          durationSeconds: durationSeconds
            ? parseInt(durationSeconds)
            : undefined,
          seriesName: seriesName || undefined,
          seriesOrder: seriesOrder ? parseInt(seriesOrder) : undefined,
          isActive,
        },
        { abortEarly: false },
      );

      setErrorMessage('');
      setFieldErrors({});

      const response = await fetch(
        `/api/dashboard/channel/${video.video_id}/edit`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        trackForm('edit_video_successful', { videoId: video.video_id });
        router.push('/dashboard/channel?updated=true');
      } else {
        setErrorMessage(data.message || 'Failed to update video.');
        trackValidation('edit_video_failed', {}, 'warning');
      }
    } catch (error) {
      if (error.name === 'ValidationError') {
        const errors = {};
        error.inner.forEach((err) => {
          errors[err.path] = err.message;
        });
        setFieldErrors(errors);
        setErrorMessage(
          'Please fix the validation errors below and try again.',
        );
        trackValidation(
          'edit_video_validation_failed',
          { errors: error.inner.map((err) => err.path) },
          'warning',
        );
      } else if (error.message?.includes('HTTP error')) {
        setErrorMessage('Server error. Please try again.');
        trackUploadError(error, 'edit_video_http');
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
        trackUploadError(error, 'edit_video');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`${styles.editVideoContainer} ${isActive ? styles.activeContainer : styles.inactiveContainer}`}
    >
      <Link
        href={`/dashboard/channel/${video.video_id}`}
        className={styles.backButton}
        onClick={() => trackNavigation('back_from_edit_video')}
      >
        <MdArrowBack /> Back to Video
      </Link>

      <div className={styles.header}>
        <h1>Edit Video</h1>
        <div
          className={`${styles.statusIndicator} ${isActive ? styles.active : styles.inactive}`}
        >
          {isActive ? (
            <>
              <MdCheck className={styles.statusIcon} />
              <span>Active Video</span>
            </>
          ) : (
            <>
              <MdClose className={styles.statusIcon} />
              <span>Inactive Video</span>
            </>
          )}
        </div>
      </div>

      {/* Info lecture seule */}
      <div className={styles.readOnlySection}>
        <h3>
          <MdInfo className={styles.infoIcon} />
          Video Information
        </h3>
        <div className={styles.readOnlyGrid}>
          <div className={styles.readOnlyItem}>
            <strong>Views Count:</strong>
            <span className={styles.viewsCount}>
              👁 {video.views_count} views
            </span>
          </div>
          <div className={styles.readOnlyItem}>
            <strong>Created:</strong>
            <span className={styles.dateValue}>
              {formatDate(video.created_at)}
            </span>
          </div>
          <div className={styles.readOnlyItem}>
            <strong>Last Updated:</strong>
            <span className={styles.dateValue}>
              {formatDate(video.updated_at)}
            </span>
          </div>
        </div>
      </div>

      <form className={styles.editVideoForm} onSubmit={handleSubmit}>
        {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}

        {/* ===== CHAMPS PRINCIPAUX ===== */}
        <div className={styles.inputs}>
          {/* Title */}
          <div className={styles.inputGroup}>
            <input
              type="text"
              placeholder="Video Title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={hasFieldError('title') ? styles.inputError : ''}
              required
            />
            {hasFieldError('title') && (
              <div className={styles.fieldError}>
                <MdError className={styles.errorIcon} />
                <span>{getFieldError('title')}</span>
              </div>
            )}
          </div>

          {/* Duration */}
          <div className={styles.inputGroup}>
            <input
              type="number"
              placeholder="Duration (seconds)"
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(e.target.value)}
              className={
                hasFieldError('durationSeconds') ? styles.inputError : ''
              }
              min="1"
            />
            {hasFieldError('durationSeconds') && (
              <div className={styles.fieldError}>
                <MdError className={styles.errorIcon} />
                <span>{getFieldError('durationSeconds')}</span>
              </div>
            )}
          </div>

          {/* Level */}
          <div className={styles.inputGroup}>
            <select
              value={level}
              onChange={(e) => setLevel(parseInt(e.target.value))}
              className={`${styles.select} ${hasFieldError('level') ? styles.inputError : ''}`}
              required
            >
              <option value="">Select Level *</option>
              <option value={1}>1 - Beginner</option>
              <option value={2}>2 - Elementary</option>
              <option value={3}>3 - Intermediate</option>
              <option value={4}>4 - Advanced</option>
              <option value={5}>5 - Expert</option>
            </select>
            {hasFieldError('level') && (
              <div className={styles.fieldError}>
                <MdError className={styles.errorIcon} />
                <span>{getFieldError('level')}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className={styles.inputGroup}>
            <input
              type="text"
              placeholder='Tags (comma separated: "react, api, démo")'
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className={hasFieldError('tags') ? styles.inputError : ''}
            />
            {hasFieldError('tags') && (
              <div className={styles.fieldError}>
                <MdError className={styles.errorIcon} />
                <span>{getFieldError('tags')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className={styles.inputGroup}>
          <textarea
            className={`${styles.description} ${hasFieldError('description') ? styles.inputError : ''}`}
            placeholder="Video Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="4"
          />
          {hasFieldError('description') && (
            <div className={styles.fieldError}>
              <MdError className={styles.errorIcon} />
              <span>{getFieldError('description')}</span>
            </div>
          )}
        </div>

        {/* ===== CONTRÔLES ===== */}
        <div className={styles.controlsSection}>
          {/* Catégorie */}
          <div className={styles.categoryGroup}>
            <h4>Category *</h4>
            <div
              className={
                hasFieldError('category') ? styles.radioGroupError : ''
              }
            >
              {CATEGORIES.map((cat) => (
                <label key={cat.value} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="category"
                    value={cat.value}
                    checked={category === cat.value}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  />
                  <span>{cat.label}</span>
                </label>
              ))}
            </div>
            {hasFieldError('category') && (
              <div className={styles.fieldError}>
                <MdError className={styles.errorIcon} />
                <span>{getFieldError('category')}</span>
              </div>
            )}
          </div>

          {/* Status toggle */}
          <div className={styles.activeToggle}>
            <h4>Video Status</h4>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className={styles.activeCheckbox}
              />
              <span
                className={`${styles.checkboxText} ${isActive ? styles.activeText : styles.inactiveText}`}
              >
                {isActive ? 'Video is Active' : 'Video is Inactive'}
              </span>
            </label>
          </div>
        </div>

        {/* ===== SÉRIE ===== */}
        <div className={styles.seriesSection}>
          <h4>Series (optional)</h4>
          <p className={styles.sectionDescription}>
            Group this video into a series of related content
          </p>
          <div className={styles.seriesInputs}>
            <div className={styles.inputGroup}>
              <input
                type="text"
                placeholder="Series Name (e.g. 'Getting Started')"
                value={seriesName}
                onChange={(e) => setSeriesName(e.target.value)}
                className={hasFieldError('seriesName') ? styles.inputError : ''}
              />
              {hasFieldError('seriesName') && (
                <div className={styles.fieldError}>
                  <MdError className={styles.errorIcon} />
                  <span>{getFieldError('seriesName')}</span>
                </div>
              )}
            </div>
            <div className={styles.inputGroup}>
              <input
                type="number"
                placeholder="Episode # in series"
                value={seriesOrder}
                onChange={(e) => setSeriesOrder(e.target.value)}
                className={
                  hasFieldError('seriesOrder') ? styles.inputError : ''
                }
                min="1"
              />
              {hasFieldError('seriesOrder') && (
                <div className={styles.fieldError}>
                  <MdError className={styles.errorIcon} />
                  <span>{getFieldError('seriesOrder')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== RELATIONS ===== */}
        <div className={styles.relationsSection}>
          <h4>Related Content (optional)</h4>
          <p className={styles.sectionDescription}>
            Link this video to an application or template in your catalog
          </p>
          <div className={styles.relationsInputs}>
            <div className={styles.inputGroup}>
              <input
                type="text"
                placeholder="Related Application ID (UUID)"
                value={relatedApplicationId}
                onChange={(e) => setRelatedApplicationId(e.target.value)}
              />
            </div>
            <div className={styles.inputGroup}>
              <input
                type="text"
                placeholder="Related Template ID (UUID)"
                value={relatedTemplateId}
                onChange={(e) => setRelatedTemplateId(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ===== VIDEO CLOUDINARY ===== */}
        <div className={styles.assetSection}>
          <h4>Video File</h4>
          <p className={styles.sectionDescription}>
            Replace the current video file (the old one will be deleted from
            Cloudinary)
          </p>

          {/* Preview actuel */}
          <div className={styles.currentAsset}>
            <span className={styles.currentAssetLabel}>Current ID:</span>
            <code className={styles.cloudinaryId}>{cloudinaryId}</code>
          </div>

          <CldUploadWidget
            signatureEndpoint="/api/dashboard/channel/add/sign-video"
            onSuccess={(result) => {
              setCloudinaryId(result?.info?.public_id);
              if (result?.info?.duration) {
                setDurationSeconds(Math.round(result.info.duration));
              }
              trackUpload('video_replaced_in_edit', {
                videoId: video.video_id,
                newPublicId: result?.info?.public_id,
              });
            }}
            options={{
              folder: 'channel',
              resourceType: 'video',
              multiple: false,
            }}
          >
            {({ open }) => (
              <button
                className={styles.uploadButton}
                onClick={(e) => {
                  e.preventDefault();
                  open();
                }}
                type="button"
                disabled={isSubmitting}
              >
                {cloudinaryId !== oldCloudinaryId
                  ? '✓ New video ready'
                  : 'Replace Video'}
              </button>
            )}
          </CldUploadWidget>

          {cloudinaryId !== oldCloudinaryId && (
            <p className={styles.newAssetNotice}>
              ✓ New video uploaded — will replace the old one on save
            </p>
          )}
        </div>

        {/* ===== THUMBNAIL ===== */}
        <div className={styles.assetSection}>
          <h4>Thumbnail (optional)</h4>
          <p className={styles.sectionDescription}>
            Replace or add a thumbnail image for this video
          </p>

          {thumbnailId && (
            <div className={styles.thumbnailPreview}>
              <img
                src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_240,h_135/${thumbnailId}`}
                alt="Thumbnail preview"
                className={styles.thumbnailImg}
              />
              <button
                type="button"
                className={styles.removeThumbnail}
                onClick={() => {
                  setThumbnailId(null);
                  trackUpload('thumbnail_removed_in_edit', {
                    videoId: video.video_id,
                  });
                }}
                disabled={isSubmitting}
              >
                Remove thumbnail
              </button>
            </div>
          )}

          <CldUploadWidget
            signatureEndpoint="/api/dashboard/channel/add/sign-video"
            onSuccess={(result) => {
              setThumbnailId(result?.info?.public_id);
              trackUpload('thumbnail_replaced_in_edit', {
                videoId: video.video_id,
                newPublicId: result?.info?.public_id,
              });
            }}
            options={{
              folder: 'channel',
              resourceType: 'image',
              multiple: false,
            }}
          >
            {({ open }) => (
              <button
                className={styles.uploadButton}
                onClick={(e) => {
                  e.preventDefault();
                  open();
                }}
                type="button"
                disabled={isSubmitting}
              >
                {thumbnailId ? 'Replace Thumbnail' : 'Add Thumbnail'}
              </button>
            )}
          </CldUploadWidget>
        </div>

        <button
          type="submit"
          className={styles.saveButton}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
