// utils/schemas/platformSchema.js
import * as yup from 'yup';

/**
 * Schema de validation pour l'ajout d'une plateforme de paiement
 * ✅ SUPPORT CASH : account_name et account_number optionnels si is_cash_payment = true
 */
export const platformAddingSchema = yup.object().shape({
  platformName: yup
    .string()
    .required('Platform name is required')
    .min(3, 'Platform name must be at least 3 characters')
    .max(50, 'Platform name must not exceed 50 characters')
    .matches(
      /^[a-zA-Z0-9._\s-]+$/,
      'Platform name can only contain letters, numbers, spaces, and ._-',
    )
    .matches(/^[a-zA-Z]/, 'Platform name must start with a letter')
    .test(
      'no-only-spaces',
      'Platform name cannot contain only spaces',
      (value) => value && value.trim().length > 0,
    )
    .transform((value) => value?.trim()),

  // ✅ NOUVEAU : is_cash_payment
  isCashPayment: yup.boolean().default(false),

  // ✅ MODIFIÉ : Requis seulement si NOT cash payment
  accountName: yup.string().when('isCashPayment', {
    is: false,
    then: (schema) =>
      schema
        .required('Account name is required for electronic platforms')
        .min(3, 'Account name must be at least 3 characters')
        .max(255, 'Account name must not exceed 255 characters')
        .matches(
          /^[a-zA-Z0-9._\s-]+$/,
          'Account name can only contain letters, numbers, spaces, and ._-',
        )
        .test(
          'no-only-spaces',
          'Account name cannot contain only spaces',
          (value) => value && value.trim().length > 0,
        )
        .transform((value) => value?.trim()),
    otherwise: (schema) => schema.nullable().transform(() => null),
  }),

  // ✅ MODIFIÉ : Requis seulement si NOT cash payment
  accountNumber: yup.string().when('isCashPayment', {
    is: false,
    then: (schema) =>
      schema
        .required('Account number is required for electronic platforms')
        .min(3, 'Account number must be at least 3 characters')
        .max(20, 'Account number must not exceed 20 characters')
        .matches(
          /^[0-9+]+$/,
          'Account number can only contain digits and + sign',
        )
        .test(
          'no-only-plus',
          'Account number must contain at least one digit',
          (value) => value && /\d/.test(value),
        )
        .transform((value) => value?.trim()),
    otherwise: (schema) => schema.nullable().transform(() => null),
  }),

  // ✅ NOUVEAU : Description optionnelle
  description: yup
    .string()
    .max(500, 'Description must not exceed 500 characters')
    .nullable()
    .transform((value) => value?.trim() || null),
});

/**
 * Schema de validation pour la mise à jour d'une plateforme
 * ✅ SUPPORT CASH : Validation conditionnelle basée sur is_cash_payment
 */
export const platformUpdateSchema = yup
  .object()
  .shape({
    platformName: yup
      .string()
      .min(3, 'Platform name must be at least 3 characters')
      .max(50, 'Platform name must not exceed 50 characters')
      .matches(
        /^[a-zA-Z0-9._\s-]+$/,
        'Platform name can only contain letters, numbers, spaces, and ._-',
      )
      .matches(/^[a-zA-Z]/, 'Platform name must start with a letter')
      .test(
        'no-only-spaces',
        'Platform name cannot contain only spaces',
        (value) => !value || value.trim().length > 0,
      )
      .transform((value) => value?.trim()),

    // ✅ NOUVEAU : is_cash_payment
    isCashPayment: yup.boolean(),

    // ✅ MODIFIÉ : Validation conditionnelle
    accountName: yup.string().when('isCashPayment', {
      is: false,
      then: (schema) =>
        schema
          .min(3, 'Account name must be at least 3 characters')
          .max(255, 'Account name must not exceed 255 characters')
          .matches(
            /^[a-zA-Z0-9._\s-]+$/,
            'Account name can only contain letters, numbers, spaces, and ._-',
          )
          .test(
            'no-only-spaces',
            'Account name cannot contain only spaces',
            (value) => !value || value.trim().length > 0,
          )
          .transform((value) => value?.trim()),
      otherwise: (schema) => schema.nullable().transform(() => null),
    }),

    // ✅ MODIFIÉ : Validation conditionnelle
    accountNumber: yup.string().when('isCashPayment', {
      is: false,
      then: (schema) =>
        schema
          .min(3, 'Account number must be at least 3 characters')
          .max(20, 'Account number must not exceed 20 characters')
          .matches(
            /^[0-9+]+$/,
            'Account number can only contain digits and + sign',
          )
          .test(
            'no-only-plus',
            'Account number must contain at least one digit',
            (value) => !value || /\d/.test(value),
          )
          .transform((value) => value?.trim()),
      otherwise: (schema) => schema.nullable().transform(() => null),
    }),

    // ✅ NOUVEAU : Description
    description: yup
      .string()
      .max(500, 'Description must not exceed 500 characters')
      .nullable()
      .transform((value) => value?.trim() || null),

    isActive: yup
      .boolean()
      .typeError('Platform status must be a boolean value'),
  })
  .test(
    'at-least-one-field',
    'At least one field must be provided for update',
    (values) => {
      const providedFields = Object.keys(values).filter(
        (key) =>
          values[key] !== undefined &&
          values[key] !== null &&
          (typeof values[key] === 'boolean' || values[key] !== ''),
      );
      return providedFields.length > 0;
    },
  );

/**
 * Schema de validation pour l'ID d'une plateforme (UUID)
 */
export const platformIdSchema = yup.object().shape({
  id: yup
    .string()
    .required('Platform ID is required')
    .matches(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      'Invalid platform ID format (must be a valid UUID)',
    )
    .transform((value) => value?.toLowerCase().trim()),
});

/**
 * Fonction utilitaire pour nettoyer un UUID
 */
export const cleanUUID = (uuid) => {
  if (!uuid || typeof uuid !== 'string') return null;

  const cleaned = uuid.toLowerCase().trim();
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(cleaned)) return null;

  const emptyUUIDs = [
    '00000000-0000-0000-0000-000000000000',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
  ];

  if (emptyUUIDs.includes(cleaned)) return null;

  return cleaned;
};

export default {
  platformAddingSchema,
  platformUpdateSchema,
  platformIdSchema,
  cleanUUID,
};
