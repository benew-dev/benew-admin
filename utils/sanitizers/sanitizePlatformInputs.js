// utils/sanitizers/sanitizePlatformInputs.js

/**
 * Sanitize le nom de la plateforme
 */
const sanitizePlatformName = (platformName) => {
  if (typeof platformName !== 'string') return platformName;

  return platformName
    .replace(/[^a-zA-Z0-9._\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Sanitize le nom du compte
 * ✅ Retourne null si vide (pour CASH)
 */
const sanitizeAccountName = (accountName) => {
  if (typeof accountName !== 'string') return accountName;

  const sanitized = accountName
    .replace(/[^a-zA-Z0-9._\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized || null;
};

/**
 * Sanitize le numéro de compte
 * ✅ Retourne null si vide (pour CASH)
 */
const sanitizeAccountNumber = (accountNumber) => {
  if (typeof accountNumber !== 'string') return accountNumber;

  const sanitized = accountNumber.replace(/[^0-9+]/g, '').trim();

  return sanitized || null;
};

/**
 * ✅ NOUVEAU : Sanitize la description
 */
const sanitizeDescription = (description) => {
  if (typeof description !== 'string') return description;

  const sanitized = description
    .replace(/[<>]/g, '') // Retirer < et >
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized || null;
};

/**
 * Sanitize les données du formulaire d'ajout de plateforme
 * ✅ SUPPORT CASH : Gère isCashPayment et description
 */
export const sanitizePlatformInputs = (formData) => {
  const isCashPayment = Boolean(formData.isCashPayment);

  return {
    platformName: sanitizePlatformName(formData.platformName || ''),
    isCashPayment,
    // ✅ Si CASH, account_name et account_number = null
    accountName: isCashPayment
      ? null
      : sanitizeAccountName(formData.accountName || ''),
    accountNumber: isCashPayment
      ? null
      : sanitizeAccountNumber(formData.accountNumber || ''),
    description: sanitizeDescription(formData.description || ''),
  };
};

/**
 * Version stricte avec validation supplémentaire
 * ✅ SUPPORT CASH : Gère isCashPayment
 */
export const sanitizePlatformInputsStrict = (formData) => {
  const basicSanitized = sanitizePlatformInputs(formData);

  return {
    platformName: basicSanitized.platformName.slice(0, 50),
    isCashPayment: basicSanitized.isCashPayment,
    accountName: basicSanitized.accountName
      ? basicSanitized.accountName.slice(0, 255)
      : null,
    accountNumber: basicSanitized.accountNumber
      ? basicSanitized.accountNumber.slice(0, 20)
      : null,
    description: basicSanitized.description
      ? basicSanitized.description.slice(0, 500)
      : null,
  };
};

/**
 * Sanitize les données du formulaire de modification
 * ✅ SUPPORT CASH : Gère isCashPayment et description
 */
export const sanitizePlatformUpdateInputs = (formData) => {
  const sanitizedData = {};

  if (Object.prototype.hasOwnProperty.call(formData, 'platformName')) {
    sanitizedData.platformName = sanitizePlatformName(
      formData.platformName || '',
    );
  }

  // ✅ NOUVEAU : Gérer isCashPayment
  if (Object.prototype.hasOwnProperty.call(formData, 'isCashPayment')) {
    sanitizedData.isCashPayment = Boolean(formData.isCashPayment);
  }

  // ✅ MODIFIÉ : Sanitize accountName (peut être null)
  if (Object.prototype.hasOwnProperty.call(formData, 'accountName')) {
    sanitizedData.accountName = sanitizeAccountName(formData.accountName || '');
  }

  // ✅ MODIFIÉ : Sanitize accountNumber (peut être null)
  if (Object.prototype.hasOwnProperty.call(formData, 'accountNumber')) {
    sanitizedData.accountNumber = sanitizeAccountNumber(
      formData.accountNumber || '',
    );
  }

  // ✅ NOUVEAU : Gérer description
  if (Object.prototype.hasOwnProperty.call(formData, 'description')) {
    sanitizedData.description = sanitizeDescription(formData.description || '');
  }

  if (Object.prototype.hasOwnProperty.call(formData, 'isActive')) {
    sanitizedData.isActive = Boolean(formData.isActive);
  }

  return sanitizedData;
};

/**
 * Version stricte pour la modification
 * ✅ SUPPORT CASH : Gère isCashPayment et description
 */
export const sanitizePlatformUpdateInputsStrict = (formData) => {
  const basicSanitized = sanitizePlatformUpdateInputs(formData);
  const strictSanitized = { ...basicSanitized };

  if (
    'platformName' in strictSanitized &&
    typeof strictSanitized.platformName === 'string'
  ) {
    strictSanitized.platformName = strictSanitized.platformName.slice(0, 50);
  }

  if (
    'accountName' in strictSanitized &&
    typeof strictSanitized.accountName === 'string'
  ) {
    strictSanitized.accountName = strictSanitized.accountName.slice(0, 255);
  }

  if (
    'accountNumber' in strictSanitized &&
    typeof strictSanitized.accountNumber === 'string'
  ) {
    strictSanitized.accountNumber = strictSanitized.accountNumber.slice(0, 20);
  }

  if (
    'description' in strictSanitized &&
    typeof strictSanitized.description === 'string'
  ) {
    strictSanitized.description = strictSanitized.description.slice(0, 500);
  }

  return strictSanitized;
};

export default {
  sanitizePlatformInputs,
  sanitizePlatformInputsStrict,
  sanitizePlatformUpdateInputs,
  sanitizePlatformUpdateInputsStrict,
};
