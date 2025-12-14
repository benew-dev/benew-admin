// lib/auth-utils.js
import { cache } from 'react';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import logger from '@/utils/logger';

/**
 * Récupère l'utilisateur authentifié
 * @returns {Promise<Object|null>} User object ou null si non authentifié
 */
export const getAuthenticatedUser = cache(async () => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return null;
    }

    return session.user;
  } catch (error) {
    logger.error('Failed to get authenticated user', {
      error: error.message,
    });
    return null;
  }
});
