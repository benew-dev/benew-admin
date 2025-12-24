// app/dashboard/templates/add/error.jsx - ADD TEMPLATE ERROR BOUNDARY
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import styles from '@/ui/styling/dashboard/templates/addError.module.css';

/**
 * ADD TEMPLATE ERROR BOUNDARY - Client Component
 *
 * Production-ready error handling for add template page (5 users/day):
 * - Captures errors during template creation workflow
 * - Upload errors (Cloudinary)
 * - Form validation errors
 * - API submission errors
 * - Automatic Sentry reporting with add template context
 * - Recovery actions specific to template creation
 *
 * IMPORTANT: This catches errors in:
 * - AddTemplateForm component
 * - Image upload process
 * - Form validation
 * - API submission
 * - Does NOT catch: Templates list errors (parent error.jsx)
 */
export default function AddTemplateError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    // ✅ Report error to Sentry with add template context
    Sentry.captureException(error, {
      tags: {
        component: 'add-template-error-boundary',
        area: 'templates-add',
        feature: 'template-creation',
        critical: 'true', // Template creation errors are critical
      },
      contexts: {
        error_info: {
          name: error.name || 'UnknownError',
          message: error.message || 'No error message',
        },
        templates: {
          route: '/dashboard/templates/add',
          operation: 'create',
        },
      },
    });

    // ✅ Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Add template error:', error);
    }
  }, [error]);

  // Determine error type for user-friendly messaging
  const getErrorInfo = () => {
    const errorMessage = error?.message?.toLowerCase() || '';

    // Cloudinary upload errors (common in add template)
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
        advice: 'Your template data has not been saved. Please try again.',
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
          'Some of the template information is invalid or missing. Please check your inputs and try again.',
        icon: '⚠️',
        showRetry: true,
        showGoToList: false,
        showGoToDashboard: false,
        advice:
          'Make sure all required fields are filled and images are in correct format (JPEG, PNG, WebP).',
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
          'Unable to save the template to the database. Our team has been notified and is investigating.',
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
        advice: 'You will need to log in again before adding templates.',
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
      title: 'Failed to Add Template',
      description:
        'An unexpected error occurred while creating the template. Our team has been notified. Please try again or contact support if the problem persists.',
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
    router.push('/dashboard/templates');
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  const handleContactSupport = () => {
    const errorId = Sentry.lastEventId() || 'N/A';
    const timestamp = new Date().toISOString();

    window.location.href = `mailto:support@benew.com?subject=Add Template Error - Admin App&body=Error Reference: ${errorId}%0ATimestamp: ${timestamp}%0APage: Add Template%0ARoute: /dashboard/templates/add%0A%0APlease describe what you were trying to do:%0A- Template name:%0A- Number of images:%0A- Error encountered:%0A`;
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

        {/* Template Creation Context */}
        <div className={styles.contextNotice}>
          <strong>➕ Template Creation</strong>
          <p>
            This error occurred while trying to create a new template. Your form
            data may not have been saved.
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
              Back to Templates List
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
                <strong>Route:</strong> /dashboard/templates/add
              </p>
              <p>
                <strong>Operation:</strong> Create Template
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
