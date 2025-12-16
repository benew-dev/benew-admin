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
 */
const sanitizeAccountName = (accountName) => {
  if (typeof accountName !== 'string') return accountName;

  return accountName
    .replace(/[^a-zA-Z0-9._\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Sanitize le numéro de compte
 */
const sanitizeAccountNumber = (accountNumber) => {
  if (typeof accountNumber !== 'string') return accountNumber;

  return accountNumber.replace(/[^0-9+]/g, '').trim();
};

/**
 * Sanitize les données du formulaire d'ajout de plateforme
 */
export const sanitizePlatformInputs = (formData) => {
  return {
    platformName: sanitizePlatformName(formData.platformName || ''),
    accountName: sanitizeAccountName(formData.accountName || ''),
    accountNumber: sanitizeAccountNumber(formData.accountNumber || ''),
  };
};

/**
 * Version stricte avec validation supplémentaire
 */
export const sanitizePlatformInputsStrict = (formData) => {
  const basicSanitized = sanitizePlatformInputs(formData);

  return {
    platformName: basicSanitized.platformName.slice(0, 50),
    accountName: basicSanitized.accountName.slice(0, 255),
    accountNumber: basicSanitized.accountNumber.slice(0, 20),
  };
};

/**
 * Sanitize les données du formulaire de modification
 */
export const sanitizePlatformUpdateInputs = (formData) => {
  const sanitizedData = {};

  if (Object.prototype.hasOwnProperty.call(formData, 'platformName')) {
    sanitizedData.platformName = sanitizePlatformName(
      formData.platformName || '',
    );
  }

  if (Object.prototype.hasOwnProperty.call(formData, 'accountName')) {
    sanitizedData.accountName = sanitizeAccountName(formData.accountName || '');
  }

  if (Object.prototype.hasOwnProperty.call(formData, 'accountNumber')) {
    sanitizedData.accountNumber = sanitizeAccountNumber(
      formData.accountNumber || '',
    );
  }

  if (Object.prototype.hasOwnProperty.call(formData, 'isActive')) {
    sanitizedData.isActive = Boolean(formData.isActive);
  }

  return sanitizedData;
};

/**
 * Version stricte pour la modification
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

  return strictSanitized;
};

export default {
  sanitizePlatformInputs,
  sanitizePlatformInputsStrict,
  sanitizePlatformUpdateInputs,
  sanitizePlatformUpdateInputsStrict,
};
