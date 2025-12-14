// utils/schemas/templateSchema.js

import * as yup from 'yup';

/**
 * Schema de validation pour l'ajout d'un template
 */
export const templateAddingSchema = yup
  .object()
  .shape({
    templateName: yup
      .string()
      .required('Template name is required')
      .min(3, 'Template name must be at least 3 characters')
      .max(100, 'Template name must not exceed 100 characters')
      .matches(
        /^[a-zA-Z0-9._\s-]+$/,
        'Template name can only contain letters, numbers, spaces, and ._-',
      )
      .matches(/^[a-zA-Z]/, 'Template name must start with a letter')
      .test(
        'no-only-spaces',
        'Template name cannot contain only spaces',
        (value) => value && value.trim().length > 0,
      )
      .test(
        'no-consecutive-spaces',
        'Template name cannot contain multiple consecutive spaces',
        (value) => !value || !/\s{2,}/.test(value),
      )
      .test(
        'reserved-words',
        'This template name is not allowed',
        (value) =>
          !['admin', 'root', 'system', 'test', 'template', 'default'].includes(
            value?.toLowerCase().trim(),
          ),
      )
      .transform((value) => value?.trim()),

    // ✅ NOUVEAU: Validation ARRAY d'images
    templateImageIds: yup
      .array()
      .of(
        yup
          .string()
          .min(1, 'Invalid template image')
          .max(200, 'Template image ID is too long')
          .matches(/^[a-zA-Z0-9._/-]+$/, 'Invalid template image format'),
      )
      .min(1, 'At least one template image is required')
      .max(10, 'Maximum 10 images allowed')
      .required('Template images are required'),

    templateHasWeb: yup.boolean().required('Web availability is required'),

    templateHasMobile: yup
      .boolean()
      .required('Mobile availability is required'),
  })
  .test(
    'at-least-one-platform',
    'Template must be available for at least one platform (Web or Mobile)',
    (values) => {
      return (
        values.templateHasWeb === true || values.templateHasMobile === true
      );
    },
  );

/**
 * Schema de validation pour la mise à jour d'un template
 */
export const templateUpdateSchema = yup
  .object()
  .shape({
    templateName: yup
      .string()
      .min(3, 'Template name must be at least 3 characters')
      .max(100, 'Template name must not exceed 100 characters')
      .matches(
        /^[a-zA-Z0-9._\s-]+$/,
        'Template name can only contain letters, numbers, spaces, and ._-',
      )
      .test(
        'no-only-spaces',
        'Template name cannot contain only spaces',
        (value) => !value || value.trim().length > 0,
      )
      .test(
        'no-consecutive-spaces',
        'Template name cannot contain multiple consecutive spaces',
        (value) => !value || !/\s{2,}/.test(value),
      )
      .test('reserved-words', 'This template name is not allowed', (value) => {
        if (!value) return true;
        return ![
          'admin',
          'root',
          'system',
          'test',
          'template',
          'default',
        ].includes(value.toLowerCase().trim());
      })
      .transform((value) => value?.trim()),

    // ✅ NOUVEAU: ARRAY optionnel pour update
    templateImageIds: yup
      .array()
      .of(
        yup
          .string()
          .min(1, 'Invalid template image')
          .max(200, 'Template image ID is too long')
          .matches(/^[a-zA-Z0-9._/-]+$/, 'Invalid template image format'),
      )
      .max(10, 'Maximum 10 images allowed'),

    templateHasWeb: yup.boolean(),

    templateHasMobile: yup.boolean(),

    isActive: yup
      .boolean()
      .typeError('Active status must be a boolean value')
      .test('valid-boolean', 'Active status must be true or false', (value) => {
        if (value === undefined) return true;
        return typeof value === 'boolean';
      }),
  })
  .test(
    'at-least-one-platform-if-provided',
    'Template must be available for at least one platform (Web or Mobile)',
    (values) => {
      if (
        values.templateHasWeb !== undefined ||
        values.templateHasMobile !== undefined
      ) {
        return (
          values.templateHasWeb === true || values.templateHasMobile === true
        );
      }
      return true;
    },
  )
  .test(
    'at-least-one-field',
    'At least one field must be provided for update',
    (values) => {
      const providedFields = Object.keys(values).filter(
        (key) =>
          values[key] !== undefined &&
          values[key] !== null &&
          values[key] !== '',
      );
      return providedFields.length > 0;
    },
  );

/**
 * Schema de validation pour l'ID d'un template
 */
export const templateIdSchema = yup.object().shape({
  id: yup
    .string()
    .required('Template ID is required')
    .matches(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      'Invalid template ID format (must be a valid UUID)',
    )
    .test('is-valid-uuid', 'Template ID must be a valid UUID', (value) => {
      if (!value) return false;

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(value)) {
        return false;
      }

      const emptyUUIDs = [
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
      ];

      return !emptyUUIDs.includes(value.toLowerCase());
    })
    .transform((value) => value?.toLowerCase().trim()),
});

/**
 * Fonction utilitaire pour valider un UUID
 */
export const isValidUUID = (uuid) => {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Fonction utilitaire pour nettoyer un UUID
 */
export const cleanUUID = (uuid) => {
  if (!uuid || typeof uuid !== 'string') {
    return null;
  }

  const cleaned = uuid.toLowerCase().trim();
  return isValidUUID(cleaned) ? cleaned : null;
};

export default {
  templateAddingSchema,
  templateUpdateSchema,
  templateIdSchema,
  isValidUUID,
  cleanUUID,
};
