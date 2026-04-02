// utils/sanitizers/sanitizeVideoInputs.js

/**
 * Sanitize les données du formulaire d'ajout/modification de vidéo
 * @param {Object} formData - Les données du formulaire à sanitizer
 * @returns {Object} - Les données sanitizées
 */
export const sanitizeVideoInputs = (formData) => {
  // Sanitize le titre
  const sanitizeTitle = (title) => {
    if (typeof title !== 'string') return title;
    return title
      .replace(/[^\w\s.,!?;:()\-'"àáâãäèéêëìíîïòóôõöùúûüÿñç]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Sanitize la description
  const sanitizeDescription = (description) => {
    if (typeof description !== 'string') return description;
    if (description.trim() === '') return null;
    return description
      .replace(/[^\w\s.,!?;:()\-'"àáâãäèéêëìíîïòóôõöùúûüÿñç]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Sanitize un public_id Cloudinary
  const sanitizeCloudinaryId = (id) => {
    if (typeof id !== 'string') return id;
    return id.replace(/[^a-zA-Z0-9._/-]/g, '').trim();
  };

  // Sanitize la catégorie — texte libre, on retire juste les caractères dangereux
  const sanitizeCategory = (category) => {
    if (typeof category !== 'string') return null;
    if (category.trim() === '') return null;
    return category
      .replace(/[^\w\s.,\-'àáâãäèéêëìíîïòóôõöùúûüÿñç]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Sanitize un nombre entier positif
  const sanitizePositiveInt = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  // Sanitize les tags (array de strings)
  const sanitizeTags = (tags) => {
    if (!Array.isArray(tags)) return [];
    return tags
      .filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
      .map((tag) =>
        tag
          .replace(/[^a-zA-Z0-9._\s-]/g, '')
          .toLowerCase()
          .trim(),
      )
      .filter((tag) => tag.length > 0);
  };

  return {
    title: sanitizeTitle(formData.title || ''),
    description: sanitizeDescription(formData.description || ''),
    cloudinaryId: sanitizeCloudinaryId(formData.cloudinaryId || ''),
    thumbnailId: sanitizeCloudinaryId(formData.thumbnailId || ''),
    category: sanitizeCategory(formData.category || ''),
    tags: sanitizeTags(formData.tags || []),
    durationSeconds: sanitizePositiveInt(formData.durationSeconds),
  };
};

/**
 * Version stricte avec validation supplémentaire
 */
export const sanitizeVideoInputsStrict = (formData) => {
  const basicSanitized = sanitizeVideoInputs(formData);

  const strictSanitized = {
    ...basicSanitized,
    title: basicSanitized.title.slice(0, 255),
    cloudinaryId: basicSanitized.cloudinaryId.slice(0, 500),
    thumbnailId: basicSanitized.thumbnailId
      ? basicSanitized.thumbnailId.slice(0, 500)
      : null,
    description: basicSanitized.description
      ? basicSanitized.description.slice(0, 5000)
      : null,
    category: basicSanitized.category
      ? basicSanitized.category.slice(0, 100)
      : null,
    tags: basicSanitized.tags.slice(0, 20),
    durationSeconds:
      basicSanitized.durationSeconds !== null
        ? Math.max(basicSanitized.durationSeconds, 1)
        : null,
  };

  // Détection de contenu suspect
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /on\w+\s*=/i,
    /data:text\/html/i,
    /\.\.\//i,
    /\0/g,
    /union\s+select/i,
    /drop\s+table/i,
    /';\s*--/i,
  ];

  Object.entries(strictSanitized).forEach(([key, value]) => {
    if (typeof value === 'string') {
      suspiciousPatterns.forEach((pattern) => {
        if (pattern.test(value)) {
          console.warn(`Contenu suspect détecté dans le champ ${key} (video)`);
        }
      });
    }
  });

  if (process.env.NODE_ENV === 'development') {
    const changedFields = [];
    Object.keys(strictSanitized).forEach((key) => {
      if (formData[key] !== strictSanitized[key]) {
        changedFields.push(key);
      }
    });
    if (changedFields.length > 0) {
      console.warn('Champs sanitizés (video):', changedFields);
    }
  }

  return strictSanitized;
};

export default {
  sanitizeVideoInputs,
  sanitizeVideoInputsStrict,
};
