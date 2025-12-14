// app/api/dashboard/templates/add/sign-image/route.js
import { NextResponse } from 'next/server';
import cloudinary from '@/backend/cloudinary';
import { getAuthenticatedUser } from '@/lib/auth-utils';
import { applyRateLimit } from '@/backend/rateLimiter';
import logger from '@/utils/logger';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

// ===== RATE LIMITING =====
// Plus restrictif car génération de signatures sensible
const signatureRateLimit = applyRateLimit('IMAGE_UPLOAD', {
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 signatures par 5 minutes (suffisant pour 5 users)
  message: 'Trop de tentatives de signature. Veuillez réessayer plus tard.',
  prefix: 'cloudinary_signature',
});

// ===== MAIN HANDLER =====
export async function POST(request) {
  const requestId = crypto.randomUUID();

  try {
    // 1. Rate limiting
    const rateLimitResponse = await signatureRateLimit(request);
    if (rateLimitResponse) {
      logger.warn('Cloudinary signature rate limit exceeded', { requestId });
      return rateLimitResponse;
    }

    // 2. Authentification
    const user = await getAuthenticatedUser();
    if (!user) {
      logger.warn('Unauthenticated signature request', { requestId });

      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Unauthenticated Cloudinary signature request',
        level: 'warning',
      });

      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    // 3. Parse body
    const body = await request.json();
    const { paramsToSign } = body;

    if (!paramsToSign) {
      logger.warn('Missing paramsToSign', { requestId, userId: user.id });
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 },
      );
    }

    // 4. Ajouter le folder (sécurité)
    paramsToSign.folder = 'templates';

    // 5. Générer la signature
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET,
    );

    logger.info('Cloudinary signature generated', {
      requestId,
      userId: user.id,
    });

    Sentry.addBreadcrumb({
      category: 'cloudinary',
      message: 'Signature generated successfully',
      level: 'info',
      data: { userId: user.id },
    });

    return NextResponse.json(
      { signature },
      {
        status: 200,
        headers: {
          'X-Request-ID': requestId,
        },
      },
    );
  } catch (error) {
    logger.error('Error generating Cloudinary signature', {
      error: error.message,
      requestId,
    });

    Sentry.captureException(error, {
      tags: {
        component: 'cloudinary_signature',
        critical: 'true',
      },
      extra: { requestId },
    });

    return NextResponse.json(
      { error: 'Failed to generate signature' },
      { status: 500 },
    );
  }
}
