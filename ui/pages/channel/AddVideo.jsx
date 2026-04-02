// ui/pages/channel/AddVideo.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { CldUploadWidget } from 'next-cloudinary';
import styles from '@/ui/styling/dashboard/channel/add/addVideo.module.css';
import { videoAddingSchema } from '@/utils/schemas/videoSchema';
import {
  trackForm,
  trackUpload,
  trackUploadError,
  trackValidation,
} from '@/utils/monitoring';

export default function AddVideo() {
  const router = useRouter();

  // Champs obligatoires
  const [title, setTitle] = useState('');
  const [cloudinaryId, setCloudinaryId] = useState('');
  const [category, setCategory] = useState('');

  // Champs optionnels
  const [description, setDescription] = useState('');
  const [thumbnailId, setThumbnailId] = useState('');
  const [tags, setTags] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('');

  // État du formulaire
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const parseTags = (tagsString) => {
    if (!tagsString || tagsString.trim() === '') return [];
    return tagsString
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    trackForm('add_video_submit_started');

    // Validation basique
    if (!title || title.trim().length < 3) {
      setErrorMessage('Le titre de la vidéo est requis (min 3 caractères)');
      setIsLoading(false);
      return;
    }

    if (!cloudinaryId) {
      setErrorMessage('Veuillez uploader une vidéo');
      setIsLoading(false);
      return;
    }

    if (!category) {
      setErrorMessage('La catégorie est requise');
      setIsLoading(false);
      return;
    }

    const parsedTags = parseTags(tags);

    const formData = {
      title: title.trim(),
      description: description.trim() || null,
      cloudinaryId,
      thumbnailId: thumbnailId || null,
      category: category.trim() || null,
      tags: parsedTags,
      durationSeconds: durationSeconds ? parseInt(durationSeconds, 10) : null,
    };

    try {
      // Validation Yup
      await videoAddingSchema.validate(formData, { abortEarly: false });

      // Envoi à l'API
      const response = await fetch('/api/dashboard/channel/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response?.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data?.success) {
        trackForm('add_video_successful', { videoId: data.videoId });
        router.push('/dashboard/channel?added=true');
      }
    } catch (validationError) {
      if (validationError.name === 'ValidationError') {
        const firstError = validationError.errors[0];
        setErrorMessage(firstError || 'Échec de la validation');
        trackValidation(
          'add_video_validation_failed',
          { error: firstError },
          'warning',
        );
      } else if (validationError.message?.includes('HTTP error')) {
        setErrorMessage('Erreur serveur. Veuillez réessayer.');
        trackUploadError(validationError, 'add_video_http');
      } else {
        setErrorMessage(
          validationError.message ||
            "Une erreur s'est produite lors de l'ajout de la vidéo",
        );
        trackUploadError(validationError, 'add_video');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className={styles.container}>
      <div className={styles.title}>
        <h2>Ajouter une nouvelle vidéo</h2>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}

        {/* === SECTION PRINCIPALE === */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Informations principales</h3>

          <div className={styles.inputs}>
            {/* Titre */}
            <div className={styles.inputGroup}>
              <label htmlFor="title" className={styles.label}>
                Titre de la vidéo *
              </label>
              <input
                type="text"
                id="title"
                placeholder="Ex: Introduction à Next.js 16..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={styles.input}
              />
            </div>

            {/* Catégorie */}
            <div className={styles.inputGroup}>
              <label htmlFor="category" className={styles.label}>
                Catégorie
              </label>
              <input
                type="text"
                id="category"
                placeholder="Ex: tutoriel, présentation, démo..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={styles.input}
              />
            </div>

            {/* Tags */}
            <div className={styles.inputGroup}>
              <label htmlFor="tags" className={styles.label}>
                Tags (séparés par des virgules)
              </label>
              <input
                type="text"
                id="tags"
                placeholder="Ex: nextjs, auth, postgresql, react"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className={styles.input}
              />
              {tags && (
                <div className={styles.tagsPreview}>
                  {parseTags(tags).map((tag, i) => (
                    <span key={i} className={styles.tagBadge}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === DESCRIPTION === */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Description</h3>
          <div className={styles.inputGroup}>
            <label htmlFor="description" className={styles.label}>
              Description (optionnel)
            </label>
            <textarea
              id="description"
              placeholder="Décrivez le contenu de la vidéo..."
              rows="4"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.textarea}
            />
          </div>
        </div>

        {/* === UPLOAD VIDÉO === */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Vidéo *</h3>

          <CldUploadWidget
            signatureEndpoint="/api/dashboard/channel/add/sign-video"
            onSuccess={(result) => {
              const info = result?.info;
              setCloudinaryId(info?.public_id || '');

              // Récupérer la durée automatiquement si disponible
              if (info?.duration) {
                setDurationSeconds(Math.round(info.duration).toString());
              }

              trackUpload('video_uploaded_successfully', {
                videoId: info?.public_id,
                duration: info?.duration,
              });
            }}
            options={{
              folder: 'channel',
              multiple: false,
              sources: ['local'],
              resourceType: 'video',
              clientAllowedFormats: ['mp4', 'mov', 'avi', 'webm', 'mkv'],
              maxFileSize: 500000000, // 500MB
            }}
          >
            {({ open }) => (
              <div className={styles.uploadArea}>
                <button
                  type="button"
                  className={`${styles.uploadButton} ${cloudinaryId ? styles.uploadSuccess : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    open();
                  }}
                >
                  {cloudinaryId ? '✓ Vidéo uploadée' : 'Uploader la vidéo'}
                </button>
                {cloudinaryId && (
                  <p className={styles.uploadedId}>
                    ID: <code>{cloudinaryId}</code>
                  </p>
                )}
                <p className={styles.uploadHint}>
                  Formats acceptés: MP4, MOV, AVI, WebM, MKV (max 500MB)
                </p>
              </div>
            )}
          </CldUploadWidget>

          {/* Durée (auto-rempli ou manuel) */}
          <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
            <label htmlFor="durationSeconds" className={styles.label}>
              Durée (secondes) — rempli automatiquement après upload
            </label>
            <input
              type="number"
              id="durationSeconds"
              min="1"
              placeholder="Ex: 320"
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(e.target.value)}
              className={styles.input}
            />
          </div>
        </div>

        {/* === THUMBNAIL === */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Thumbnail (optionnel)</h3>

          <CldUploadWidget
            signatureEndpoint="/api/dashboard/channel/add/sign-video"
            onSuccess={(result) => {
              setThumbnailId(result?.info?.public_id || '');
              trackUpload('thumbnail_uploaded_successfully', {
                thumbnailId: result?.info?.public_id,
              });
            }}
            options={{
              folder: 'channel',
              multiple: false,
              sources: ['local', 'url'],
              resourceType: 'image',
              clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
              maxImageFileSize: 5000000,
            }}
          >
            {({ open }) => (
              <div className={styles.uploadArea}>
                <button
                  type="button"
                  className={`${styles.uploadButton} ${thumbnailId ? styles.uploadSuccess : styles.uploadSecondary}`}
                  onClick={(e) => {
                    e.preventDefault();
                    open();
                  }}
                >
                  {thumbnailId
                    ? '✓ Thumbnail uploadée'
                    : 'Uploader une thumbnail'}
                </button>
                {thumbnailId && (
                  <div className={styles.thumbnailPreview}>
                    <Image
                      src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_240,h_135/${thumbnailId}`}
                      alt="Thumbnail preview"
                      width={240}
                      height={135}
                      className={styles.thumbnailImage}
                    />
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => setThumbnailId('')}
                    >
                      ✕ Supprimer
                    </button>
                  </div>
                )}
              </div>
            )}
          </CldUploadWidget>
        </div>

        {/* === SUBMIT === */}
        <button
          type="submit"
          className={`${styles.submitButton} ${isLoading ? styles.loading : ''}`}
          disabled={isLoading}
        >
          {isLoading ? 'Ajout en cours...' : 'Ajouter la vidéo'}
        </button>
      </form>
    </section>
  );
}
