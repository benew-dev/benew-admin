// utils/schemas/videoSchema.js
import * as yup from 'yup';

/**
 * Schema de validation pour l'ajout d'une vidéo
 */
export const videoAddingSchema = yup.object().shape({
  title: yup
    .string()
    .required('Video title is required')
    .min(3, 'Video title must be at least 3 characters')
    .max(255, 'Video title must not exceed 255 characters')
    .test(
      'no-only-spaces',
      'Video title cannot contain only spaces',
      (value) => value && value.trim().length > 0,
    )
    .transform((value) => value?.trim()),

  description: yup
    .string()
    .nullable()
    .max(5000, 'Description must not exceed 5000 characters')
    .transform((value) => value?.trim() || null),

  cloudinaryId: yup
    .string()
    .required('Cloudinary video ID is required')
    .matches(/^[a-zA-Z0-9._/-]+$/, 'Invalid Cloudinary ID format')
    .test(
      'valid-cloudinary-id',
      'Invalid Cloudinary video ID',
      (value) => value && /[a-zA-Z0-9]/.test(value),
    )
    .max(500, 'Cloudinary ID must not exceed 500 characters'),

  thumbnailId: yup
    .string()
    .nullable()
    .matches(/^[a-zA-Z0-9._/-]+$/, 'Invalid Cloudinary thumbnail ID format')
    .max(500, 'Thumbnail ID must not exceed 500 characters')
    .transform((value) => value?.trim() || null),

  // Texte libre — nullable, pas de enum
  category: yup
    .string()
    .nullable()
    .max(100, 'Category must not exceed 100 characters')
    .transform((value) => value?.trim() || null),

  tags: yup
    .array()
    .of(
      yup
        .string()
        .max(50, 'Each tag must not exceed 50 characters')
        .matches(
          /^[a-zA-Z0-9._\s-]+$/,
          'Tags can only contain letters, numbers, spaces, and ._-',
        ),
    )
    .max(20, 'Cannot add more than 20 tags')
    .default([]),

  durationSeconds: yup
    .number()
    .nullable()
    .positive('Duration must be positive')
    .integer('Duration must be a whole number')
    .typeError('Duration must be a valid number')
    .transform((value) => (isNaN(value) ? null : value)),
});

/**
 * Schema de validation pour la mise à jour d'une vidéo
 */
export const videoUpdateSchema = yup.object().shape({
  title: yup
    .string()
    .required('Video title is required')
    .min(3, 'Video title must be at least 3 characters')
    .max(255, 'Video title must not exceed 255 characters')
    .test(
      'no-only-spaces',
      'Video title cannot contain only spaces',
      (value) => value && value.trim().length > 0,
    )
    .transform((value) => value?.trim()),

  description: yup
    .string()
    .nullable()
    .max(5000, 'Description must not exceed 5000 characters')
    .transform((value) => value?.trim() || null),

  cloudinaryId: yup
    .string()
    .optional()
    .matches(/^[a-zA-Z0-9._/-]+$/, 'Invalid Cloudinary ID format')
    .max(500, 'Cloudinary ID must not exceed 500 characters'),

  thumbnailId: yup
    .string()
    .nullable()
    .optional()
    .matches(/^[a-zA-Z0-9._/-]+$/, 'Invalid Cloudinary thumbnail ID format')
    .max(500, 'Thumbnail ID must not exceed 500 characters')
    .transform((value) => value?.trim() || null),

  // Texte libre — nullable, pas de enum
  category: yup
    .string()
    .nullable()
    .max(100, 'Category must not exceed 100 characters')
    .transform((value) => value?.trim() || null),

  tags: yup
    .array()
    .of(yup.string().max(50))
    .max(20, 'Cannot add more than 20 tags')
    .default([]),

  durationSeconds: yup
    .number()
    .nullable()
    .positive()
    .integer()
    .transform((value) => (isNaN(value) ? null : value)),

  isActive: yup
    .boolean()
    .required('Video status is required')
    .typeError('Video status must be true or false'),
});

/**
 * Schema de validation pour l'ID d'une vidéo
 */
export const videoIdSchema = yup.object().shape({
  id: yup
    .string()
    .required('Video ID is required')
    .matches(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'Video ID must be a valid UUID',
    )
    .min(36)
    .max(36)
    .trim(),
});

export default {
  videoAddingSchema,
  videoUpdateSchema,
  videoIdSchema,
};
