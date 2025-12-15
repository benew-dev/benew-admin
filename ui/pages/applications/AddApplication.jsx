// ui/pages/applications/AddApplication.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { CldUploadWidget } from 'next-cloudinary';
import styles from '@/ui/styling/dashboard/applications/add/addApplication.module.css';
import { applicationAddingSchema } from '@/utils/schemas/applicationSchema';
import {
  trackForm,
  trackUpload,
  trackUploadError,
  trackValidation,
} from '@/utils/monitoring';

export default function AddApplication({ templates }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [admin, setAdmin] = useState('');
  const [description, setDescription] = useState('');
  const [fee, setFee] = useState(0);
  const [rent, setRent] = useState(0);
  const [category, setCategory] = useState('');
  const [imageUrls, setImageUrls] = useState([]);
  const [level, setLevel] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    trackForm('add_application_submit_started');

    // Validation basique
    if (!name || name.length < 3) {
      setErrorMessage("Le nom de l'application est requis (min 3 caractères)");
      setIsLoading(false);
      return;
    }

    if (!link) {
      setErrorMessage("Le lien de l'application est requis");
      setIsLoading(false);
      return;
    }

    if (!admin) {
      setErrorMessage('Le lien admin est requis');
      setIsLoading(false);
      return;
    }

    if (!fee || fee === 0) {
      setErrorMessage("Le prix d'ouverture doit être supérieur à 0");
      setIsLoading(false);
      return;
    }

    if (rent < 0) {
      setErrorMessage('La location mensuelle ne peut pas être négative');
      setIsLoading(false);
      return;
    }

    if (!category) {
      setErrorMessage('La catégorie est requise (Web ou Mobile)');
      setIsLoading(false);
      return;
    }

    if (imageUrls.length === 0) {
      setErrorMessage('Au moins une image est requise');
      setIsLoading(false);
      return;
    }

    if (!level || level < 1 || level > 5) {
      setErrorMessage("Le niveau de l'application doit être entre 1 et 5");
      setIsLoading(false);
      return;
    }

    if (!templateId) {
      setErrorMessage('Veuillez sélectionner un template');
      setIsLoading(false);
      return;
    }

    // Vérifier compatibilité template/catégorie
    const selectedTemplate = templates.find(
      (t) => t.template_id.toString() === templateId,
    );

    if (selectedTemplate) {
      if (category === 'web' && !selectedTemplate.template_has_web) {
        setErrorMessage(
          'Le template sélectionné ne supporte pas les applications Web',
        );
        trackValidation('template_web_mismatch', {}, 'warning');
        setIsLoading(false);
        return;
      }
      if (category === 'mobile' && !selectedTemplate.template_has_mobile) {
        setErrorMessage(
          'Le template sélectionné ne supporte pas les applications Mobile',
        );
        trackValidation('template_mobile_mismatch', {}, 'warning');
        setIsLoading(false);
        return;
      }
    }

    const formData = {
      name,
      link,
      admin,
      description: description || null,
      fee: parseInt(fee, 10),
      rent: parseInt(rent, 10),
      category,
      imageUrls,
      level: parseInt(level, 10),
      templateId,
    };

    try {
      // Validation Yup
      await applicationAddingSchema.validate(formData, { abortEarly: false });

      // Envoi à l'API
      const response = await fetch('/api/dashboard/applications/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response?.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data?.success) {
        trackForm('add_application_successful', {
          applicationId: data.applicationId,
        });

        router.push('/dashboard/applications?added=true');
      }
    } catch (validationError) {
      if (validationError.name === 'ValidationError') {
        const firstError = validationError.errors[0];
        setErrorMessage(firstError || 'Échec de la validation');
        trackValidation(
          'add_application_validation_failed',
          {
            error: firstError,
          },
          'warning',
        );
      } else if (validationError.message?.includes('HTTP error')) {
        setErrorMessage('Erreur serveur. Veuillez réessayer.');
        trackUploadError(validationError, 'add_application_http');
      } else {
        setErrorMessage(
          validationError.message ||
            "Une erreur s'est produite lors de l'ajout de l'application",
        );
        trackUploadError(validationError, 'add_application');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setImageUrls((prev) => prev.filter((_, index) => index !== indexToRemove));
    trackUpload('image_removed', { index: indexToRemove });
  };

  const selectedTemplate = templates.find(
    (t) => t.template_id.toString() === templateId,
  );

  return (
    <section className={styles.createPostContainer}>
      <div className={styles.createPostTitle}>
        <h2>Ajouter une nouvelle application</h2>
      </div>

      <form className={styles.createPostForm} onSubmit={handleSubmit}>
        {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}

        <div className={styles.inputs}>
          {/* Nom */}
          <div className={styles.inputGroup}>
            <label htmlFor="name" className={styles.label}>
              Nom de l&apos;application *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="Ex: Instagram, WhatsApp, Netflix..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
            />
          </div>

          {/* Fee */}
          <div className={styles.inputGroup}>
            <label htmlFor="fee" className={styles.label}>
              Prix d&apos;ouverture du compte (Fdj) *
            </label>
            <input
              type="number"
              id="fee"
              name="fee"
              min="0"
              step="1"
              placeholder="Ex: 25"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className={styles.input}
            />
          </div>

          {/* Link */}
          <div className={styles.inputGroup}>
            <label htmlFor="link" className={styles.label}>
              Lien vers l&apos;application *
            </label>
            <input
              type="url"
              id="link"
              name="link"
              placeholder="https://example.com/app"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className={styles.input}
            />
          </div>

          {/* Admin */}
          <div className={styles.inputGroup}>
            <label htmlFor="admin" className={styles.label}>
              Lien administration *
            </label>
            <input
              type="url"
              id="admin"
              name="admin"
              placeholder="https://admin.example.com"
              value={admin}
              onChange={(e) => setAdmin(e.target.value)}
              className={styles.input}
            />
          </div>

          {/* Rent */}
          <div className={styles.inputGroup}>
            <label htmlFor="rent" className={styles.label}>
              Location mensuelle (Fdj)
            </label>
            <input
              type="number"
              id="rent"
              name="rent"
              min="0"
              step="1"
              placeholder="Ex: 5 (optionnel)"
              value={rent}
              onChange={(e) => setRent(e.target.value)}
              className={styles.input}
            />
          </div>

          {/* Level */}
          <div className={styles.inputGroup}>
            <label htmlFor="level" className={styles.label}>
              Niveau d&apos;application (1-5) *
            </label>
            <select
              id="level"
              name="level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className={styles.input}
            >
              <option value="">Sélectionnez un niveau</option>
              <option value="1">Niveau 1 - Basique</option>
              <option value="2">Niveau 2 - Intermédiaire</option>
              <option value="3">Niveau 3 - Avancé</option>
              <option value="4">Niveau 4 - Expert</option>
              <option value="5">Niveau 5 - Master</option>
            </select>
          </div>

          {/* Template */}
          <div className={styles.inputGroup}>
            <label htmlFor="templateId" className={styles.label}>
              Template *
            </label>
            <select
              id="templateId"
              className={styles.input}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Sélectionnez un template</option>
              {templates.map((template) => (
                <option key={template.template_id} value={template.template_id}>
                  {template.template_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Template preview */}
        {selectedTemplate && (
          <div className={styles.templateInfo}>
            <div className={styles.templatePreviewContainer}>
              {selectedTemplate.template_images?.[0] && (
                <Image
                  src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_200,h_150/${selectedTemplate.template_images[0]}`}
                  alt={`Template ${selectedTemplate.template_name}`}
                  width={200}
                  height={150}
                  className={styles.templatePreview}
                />
              )}
              <div className={styles.templateDetails}>
                <h4>{selectedTemplate.template_name}</h4>
                <p>Disponible pour:</p>
                <div className={styles.platformSupport}>
                  {selectedTemplate.template_has_web && (
                    <span className={styles.platformBadge}>Web</span>
                  )}
                  {selectedTemplate.template_has_mobile && (
                    <span className={styles.platformBadge}>Mobile</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Description */}
        <div className={styles.inputGroup}>
          <label htmlFor="description" className={styles.label}>
            Description (optionnel)
          </label>
          <textarea
            id="description"
            name="description"
            placeholder="Décrivez les fonctionnalités principales de l'application..."
            cols="30"
            rows="4"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={styles.textarea}
          />
        </div>

        {/* Catégorie */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>Catégorie *</label>
          <div className={styles.radioButtons}>
            <div className={styles.radioOption}>
              <input
                type="radio"
                id="website"
                name="categorie"
                value="web"
                checked={category === 'web'}
                onChange={(e) => setCategory(e.target.value)}
                disabled={
                  selectedTemplate && !selectedTemplate.template_has_web
                }
                className={styles.radioInput}
              />
              <label htmlFor="website" className={styles.radioLabel}>
                Site Web
              </label>
            </div>
            <div className={styles.radioOption}>
              <input
                type="radio"
                id="mobile"
                name="categorie"
                value="mobile"
                checked={category === 'mobile'}
                onChange={(e) => setCategory(e.target.value)}
                disabled={
                  selectedTemplate && !selectedTemplate.template_has_mobile
                }
                className={styles.radioInput}
              />
              <label htmlFor="mobile" className={styles.radioLabel}>
                Application Mobile
              </label>
            </div>
          </div>
        </div>

        {/* Images */}
        <div className={styles.inputGroup}>
          <label className={styles.label}>Images de l&apos;application *</label>
          <CldUploadWidget
            signatureEndpoint="/api/dashboard/applications/add/sign-image"
            onSuccess={(result) => {
              setImageUrls((prev) => [...prev, result?.info?.public_id]);
              trackUpload('image_uploaded_successfully', {
                imageId: result?.info?.public_id,
              });
            }}
            options={{
              folder: 'applications',
              multiple: true,
              sources: ['local', 'url'],
              clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
              maxImageFileSize: 5000000,
            }}
          >
            {({ open }) => {
              function handleOnClick(e) {
                e.preventDefault();
                open();
              }
              return (
                <button
                  className={styles.addImage}
                  onClick={handleOnClick}
                  type="button"
                >
                  {imageUrls.length === 0
                    ? 'Ajouter des images'
                    : 'Ajouter une autre image'}
                </button>
              );
            }}
          </CldUploadWidget>
          <p className={styles.uploadHint}>
            Formats acceptés: JPG, PNG, WebP (max 5MB par image)
          </p>
        </div>

        {/* Preview images */}
        {imageUrls.length > 0 && (
          <div className={styles.imageGallery}>
            <h4 className={styles.galleryTitle}>
              Images ajoutées ({imageUrls.length})
            </h4>
            <div className={styles.images}>
              {imageUrls.map((url, index) => (
                <div key={index} className={styles.postDetailImage}>
                  <Image
                    src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_350,h_300/${url}`}
                    alt={`Illustration ${index + 1}`}
                    width={350}
                    height={300}
                  />
                  <button
                    type="button"
                    className={styles.removeImage}
                    onClick={() => handleRemoveImage(index)}
                    title="Supprimer cette image"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className={`${styles.addButton} ${isLoading ? styles.loading : ''}`}
          disabled={isLoading}
        >
          {isLoading ? 'Ajout en cours...' : "Ajouter l'application"}
        </button>
      </form>
    </section>
  );
}
