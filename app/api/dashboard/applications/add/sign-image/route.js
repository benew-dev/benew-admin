// app/api/dashboard/applications/add/sign-image/route.js
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import cloudinary from '@/backend/cloudinary';
import { applyRateLimit } from '@/backend/rateLimiter';
import logger from '@/utils/logger';
import { trackAuth, trackAPI, trackDatabaseError } from '@/utils/monitoring';

export const dynamic = 'force-dynamic';

const signatureRateLimit = applyRateLimit('IMAGE_UPLOAD', {
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Trop de tentatives de signature. Veuillez réessayer plus tard.',
  prefix: 'cloudinary_signature_applications',
});

export async function POST(request) {
  const requestId = crypto.randomUUID();

  try {
    // Rate limiting
    const rateLimitResponse = await signatureRateLimit(request);
    if (rateLimitResponse) {
      logger.warn('Signature rate limit exceeded', { requestId });

      trackAPI('rate_limit_exceeded', {}, 'warning');

      return rateLimitResponse;
    }

    // Authentification
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      logger.warn('Unauthenticated signature request', { requestId });

      trackAuth('unauthenticated_signature_request', {}, 'warning');

      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    // Parse body
    const body = await request.json();
    const { paramsToSign } = body;

    if (!paramsToSign) {
      logger.warn('Missing paramsToSign', { requestId });

      trackAPI('missing_params_to_sign', {}, 'warning');

      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 },
      );
    }

    // Forcer le folder
    paramsToSign.folder = 'applications';

    // Générer la signature
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET,
    );

    logger.info('Cloudinary signature generated', {
      requestId,
      userId: session.user.id,
    });

    trackAPI('signature_generated_successfully', {
      userId: session.user.id,
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

    trackDatabaseError(error, 'cloudinary_signature_applications', {
      requestId,
      critical: 'true',
    });

    return NextResponse.json(
      { error: 'Failed to generate signature' },
      { status: 500 },
    );
  }
}
