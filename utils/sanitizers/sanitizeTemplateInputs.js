// utils/sanitizers/sanitizeTemplateInputs.js

/**
 * Sanitize les données du formulaire d'ajout de template
 * @param {Object} formData - Les données du formulaire à sanitizer
 * @returns {Object} - Les données sanitizées
 */
export const sanitizeTemplateInputs = (formData) => {
  // Fonction pour sanitizer le nom du template
  const sanitizeTemplateName = (templateName) => {
    if (typeof templateName !== 'string') return templateName;

    return templateName
      .replace(/[^a-zA-Z0-9._\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Fonction pour sanitizer UN SEUL ID d'image
  const sanitizeImageId = (imageId) => {
    if (typeof imageId !== 'string') return imageId;

    return imageId.replace(/[^a-zA-Z0-9._/-]/g, '').trim();
  };

  // ✅ NOUVEAU: Fonction pour sanitizer ARRAY d'images
  const sanitizeImageIds = (imageIds) => {
    // Si ce n'est pas un array, retourner array vide
    if (!Array.isArray(imageIds)) return [];

    // Filtrer et sanitizer chaque image
    return imageIds
      .map((id) => sanitizeImageId(id))
      .filter((id) => id && id.length > 0); // Enlever les strings vides
  };

  // Application de la sanitization à chaque champ
  const sanitizedData = {
    templateName: sanitizeTemplateName(formData.templateName || ''),
    templateImageIds: sanitizeImageIds(formData.templateImageIds || []), // ✅ ARRAY
    templateHasWeb: Boolean(formData.templateHasWeb),
    templateHasMobile: Boolean(formData.templateHasMobile),
  };

  // Logs pour le debugging
  if (process.env.NODE_ENV === 'development') {
    const changedFields = [];
    Object.keys(sanitizedData).forEach((key) => {
      if (formData[key] !== sanitizedData[key] && !key.includes('Has')) {
        changedFields.push(key);
      }
    });

    if (changedFields.length > 0) {
      console.warn('Champs sanitizés (template):', changedFields);
    }
  }

  return sanitizedData;
};

/**
 * Version stricte avec validation supplémentaire
 * @param {Object} formData - Les données du formulaire à sanitizer
 * @returns {Object} - Les données sanitizées avec des vérifications supplémentaires
 */
export const sanitizeTemplateInputsStrict = (formData) => {
  const basicSanitized = sanitizeTemplateInputs(formData);

  // Vérifications supplémentaires
  const strictSanitized = {
    ...basicSanitized,

    // Limite la longueur des champs
    templateName: basicSanitized.templateName.slice(0, 100),
    // ✅ NOUVEAU: Limiter chaque image ID ET le nombre total
    templateImageIds: basicSanitized.templateImageIds
      .slice(0, 10) // Max 10 images
      .map((id) => id.slice(0, 200)), // Max 200 chars par ID
  };

  // Vérification patterns suspects
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /on\w+\s*=/i,
    /data:text\/html/i,
    /\.\.\//i,
    /\0/g,
    /expression\s*\(/i,
  ];

  Object.entries(strictSanitized).forEach(([key, value]) => {
    if (typeof value === 'string') {
      suspiciousPatterns.forEach((pattern) => {
        if (pattern.test(value)) {
          console.warn(
            `Contenu suspect détecté dans le champ ${key} (template):`,
            value,
          );
        }
      });
    }
  });

  return strictSanitized;
};
