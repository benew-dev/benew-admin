// app/dashboard/applications/add/error.jsx - ADD APPLICATION ERROR BOUNDARY
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import styles from '@/ui/styling/dashboard/applications/add/addError.module.css';

/**
 * ADD APPLICATION ERROR BOUNDARY - Client Component
 *
 * Production-ready error handling for add application page (5 users/day):
 * - Captures errors during application creation workflow
 * - Upload errors (Cloudinary)
 * - Form validation errors
 * - Template compatibility errors
 * - API submission errors
 * - Automatic Sentry reporting with add application context
 * - Recovery actions specific to application creation
 *
 * IMPORTANT: This catches errors in:
 * - AddApplication component
 * - Image upload process
 * - Template selection and validation
 * - Form validation
 * - API submission
 * - Does NOT catch: Applications list errors (parent error.jsx)
 */
export default function AddApplicationError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    // ✅ Report error to Sentry with add application context
    Sentry.captureException(error, {
      tags: {
        component: 'add-application-error-boundary',
        area: 'applications-add',
        feature: 'application-creation',
        critical: 'true', // Application creation errors are critical
      },
      contexts: {
        error_info: {
          name: error.name || 'UnknownError',
          message: error.message || 'No error message',
        },
        applications: {
          route: '/dashboard/applications/add',
          operation: 'create',
        },
      },
    });

    // ✅ Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Add application error:', error);
    }
  }, [error]);

  // Determine error type for user-friendly messaging
  const getErrorInfo = () => {
    const errorMessage = error?.message?.toLowerCase() || '';

    // Cloudinary upload errors (common in add application)
    if (
      errorMessage.includes('cloudinary') ||
      errorMessage.includes('upload') ||
      errorMessage.includes('signature')
    ) {
      return {
        title: 'Image Upload Failed',
        description:
          'There was a problem uploading your images to Cloudinary. This could be a temporary network issue or a problem with the upload service.',
        icon: '📤',
        showRetry: true,
        showGoToList: true,
        showGoToDashboard: false,
        advice:
          'Try uploading smaller images or fewer images at once. Max size is 5MB per image.',
      };
    }

    // Template-related errors
    if (
      errorMessage.includes('template') ||
      errorMessage.includes('compatibility')
    ) {
      return {
        title: 'Template Compatibility Error',
        description:
          'The selected template is not compatible with the application category (Web/Mobile). Please select a compatible template.',
        icon: '🔄',
        showRetry: true,
        showGoToList: false,
        showGoToDashboard: false,
        advice:
          'Make sure the template supports the category you selected. Check the template preview for Web/Mobile badges.',
      };
    }

    // Network/API errors
    if (
      errorMessage.includes('fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('api')
    ) {
      return {
        title: 'Connection Error',
        description:
          'Unable to connect to the server. Please check your internet connection and try again.',
        icon: '🌐',
        showRetry: true,
        showGoToList: true,
        showGoToDashboard: false,
        advice: 'Your application data has not been saved. Please try again.',
      };
    }

    // Validation errors
    if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('required')
    ) {
      return {
        title: 'Form Validation Error',
        description:
          'Some of the application information is invalid or missing. Please check your inputs and try again.',
        icon: '⚠️',
        showRetry: true,
        showGoToList: false,
        showGoToDashboard: false,
        advice:
          'Make sure all required fields are filled: name, links, fee, category, template, and at least one image. Level must be between 1-5.',
      };
    }

    // Database errors
    if (
      errorMessage.includes('database') ||
      errorMessage.includes('query') ||
      errorMessage.includes('postgres')
    ) {
      return {
        title: 'Database Error',
        description:
          'Unable to save the application to the database. Our team has been notified and is investigating.',
        icon: '💾',
        showRetry: true,
        showGoToList: true,
        showGoToDashboard: false,
        advice:
          'Your images may have been uploaded. Please wait a moment before trying again.',
      };
    }

    // Auth/Session errors
    if (
      errorMessage.includes('auth') ||
      errorMessage.includes('session') ||
      errorMessage.includes('unauthorized')
    ) {
      return {
        title: 'Session Expired',
        description:
          'Your session has expired. Please refresh the page and log in again to continue.',
        icon: '🔐',
        showRetry: false,
        showGoToList: true,
        showGoToDashboard: false,
        advice: 'You will need to log in again before adding applications.',
      };
    }

    // Rate limit errors
    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      return {
        title: 'Too Many Requests',
        description:
          'You have made too many upload attempts. Please wait a few minutes before trying again.',
        icon: '⏱️',
        showRetry: false,
        showGoToList: true,
        showGoToDashboard: false,
        advice: 'Rate limit will reset in 5 minutes.',
      };
    }

    // Generic error
    return {
      title: 'Failed to Add Application',
      description:
        'An unexpected error occurred while creating the application. Our team has been notified. Please try again or contact support if the problem persists.',
      icon: '❌',
      showRetry: true,
      showGoToList: true,
      showGoToDashboard: true,
      advice:
        'If this error persists, try refreshing the page or clearing your browser cache.',
    };
  };

  const errorInfo = getErrorInfo();

  const handleRetry = () => {
    reset(); // Attempt to recover by re-rendering
  };

  const handleRefresh = () => {
    router.refresh(); // Hard refresh the current route
  };

  const handleGoToList = () => {
    router.push('/dashboard/applications');
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  const handleContactSupport = () => {
    const errorId = Sentry.lastEventId() || 'N/A';
    const timestamp = new Date().toISOString();

    window.location.href = `mailto:support@benew.com?subject=Add Application Error - Admin App&body=Error Reference: ${errorId}%0ATimestamp: ${timestamp}%0APage: Add Application%0ARoute: /dashboard/applications/add%0A%0APlease describe what you were trying to do:%0A- Application name:%0A- Category (Web/Mobile):%0A- Template selected:%0A- Number of images:%0A- Error encountered:%0A`;
  };

  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorCard}>
        {/* Icon */}
        <div className={styles.errorIcon}>{errorInfo.icon}</div>

        {/* Title */}
        <h1 className={styles.errorTitle}>{errorInfo.title}</h1>

        {/* Description */}
        <p className={styles.errorDescription}>{errorInfo.description}</p>

        {/* Application Creation Context */}
        <div className={styles.contextNotice}>
          <strong>➕ Application Creation</strong>
          <p>
            This error occurred while trying to create a new application. Your
            form data may not have been saved.
          </p>
        </div>

        {/* Advice Box */}
        {errorInfo.advice && (
          <div className={styles.adviceBox}>
            <strong>💡 Tip:</strong>
            <p>{errorInfo.advice}</p>
          </div>
        )}

        {/* Error Reference (for support) */}
        {Sentry.lastEventId() && (
          <div className={styles.errorReference}>
            <small>
              Error ID: <code>{Sentry.lastEventId()}</code>
            </small>
            <br />
            <small className={styles.timestamp}>
              {new Date().toLocaleString()}
            </small>
          </div>
        )}

        {/* Action Buttons */}
        <div className={styles.errorActions}>
          {errorInfo.showRetry && (
            <button onClick={handleRetry} className={styles.btnPrimary}>
              Try Again
            </button>
          )}

          <button onClick={handleRefresh} className={styles.btnSecondary}>
            Refresh Form
          </button>

          {errorInfo.showGoToList && (
            <button onClick={handleGoToList} className={styles.btnSecondary}>
              Back to Applications List
            </button>
          )}

          {errorInfo.showGoToDashboard && (
            <button onClick={handleGoToDashboard} className={styles.btnLink}>
              Go to Dashboard
            </button>
          )}

          <button onClick={handleContactSupport} className={styles.btnLink}>
            Contact Support
          </button>
        </div>

        {/* Developer Info (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <details className={styles.errorDetails}>
            <summary>Developer Info (dev only)</summary>
            <div className={styles.debugInfo}>
              <p>
                <strong>Error Name:</strong> {error.name || 'Unknown'}
              </p>
              <p>
                <strong>Error Message:</strong> {error.message || 'No message'}
              </p>
              <p>
                <strong>Route:</strong> /dashboard/applications/add
              </p>
              <p>
                <strong>Operation:</strong> Create Application
              </p>
              {error.digest && (
                <p>
                  <strong>Error Digest:</strong> {error.digest}
                </p>
              )}
              {error.stack && (
                <pre className={styles.errorStack}>{error.stack}</pre>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
