// app/dashboard/applications/[id]/edit/error.jsx - EDIT APPLICATION ERROR BOUNDARY
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import styles from '@/ui/styling/dashboard/applications/edit/editError.module.css';

/**
 * EDIT APPLICATION ERROR BOUNDARY - Client Component
 *
 * Production-ready error handling for edit application page (5 users/day):
 * - Captures errors during application edit workflow
 * - Database fetch errors
 * - Upload errors (Cloudinary)
 * - Form validation errors
 * - API update errors
 * - Automatic Sentry reporting with edit application context
 * - Recovery actions specific to application editing
 *
 * IMPORTANT: This catches errors in:
 * - EditApplication component
 * - Image upload/removal process
 * - Form validation
 * - API update submission
 * - Does NOT catch: Application not found (handled by not-found.jsx)
 */
export default function EditApplicationError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    // ✅ Report error to Sentry with edit application context
    Sentry.captureException(error, {
      tags: {
        component: 'edit-application-error-boundary',
        area: 'applications-edit',
        feature: 'application-editing',
        critical: 'true',
      },
      contexts: {
        error_info: {
          name: error.name || 'UnknownError',
          message: error.message || 'No error message',
        },
        applications: {
          route: '/dashboard/applications/[id]/edit',
          operation: 'edit',
        },
      },
    });

    // ✅ Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Edit application error:', error);
    }
  }, [error]);

  // Determine error type for user-friendly messaging
  const getErrorInfo = () => {
    const errorMessage = error?.message?.toLowerCase() || '';

    // Database fetch errors
    if (
      errorMessage.includes('database') ||
      errorMessage.includes('query') ||
      errorMessage.includes('postgres') ||
      errorMessage.includes('connection')
    ) {
      return {
        title: 'Database Error',
        description:
          'Unable to load or update the application data. This could be a temporary database issue. Our team has been notified.',
        icon: '💾',
        showRetry: true,
        showGoToList: true,
        showGoToDashboard: false,
        advice:
          'Your changes may not have been saved. Please try again in a moment.',
      };
    }

    // Cloudinary upload errors
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
          'Existing images are safe. Try uploading new images one at a time or in smaller batches.',
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
        advice:
          'Your changes may not have been saved. Please verify your connection.',
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
          'Make sure all required fields are filled: name, links, fee, rent, category, level, and at least one image.',
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
          'Your session has expired. Please refresh the page and log in again to continue editing.',
        icon: '🔐',
        showRetry: false,
        showGoToList: true,
        showGoToDashboard: false,
        advice:
          'You will need to log in again before making changes. Your unsaved changes will be lost.',
      };
    }

    // Rate limit errors
    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      return {
        title: 'Too Many Requests',
        description:
          'You have made too many update attempts. Please wait a few minutes before trying again.',
        icon: '⏱️',
        showRetry: false,
        showGoToList: true,
        showGoToDashboard: false,
        advice: 'Rate limit will reset in 5 minutes.',
      };
    }

    // Application not found (should be caught by not-found.jsx but just in case)
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return {
        title: 'Application Not Found',
        description:
          'The application you are trying to edit no longer exists or has been deleted.',
        icon: '🔍',
        showRetry: false,
        showGoToList: true,
        showGoToDashboard: true,
        advice:
          'The application may have been deleted by another administrator.',
      };
    }

    // Generic error
    return {
      title: 'Failed to Edit Application',
      description:
        'An unexpected error occurred while editing the application. Our team has been notified. Please try again or contact support if the problem persists.',
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

    window.location.href = `mailto:support@benew.com?subject=Edit Application Error - Admin App&body=Error Reference: ${errorId}%0ATimestamp: ${timestamp}%0APage: Edit Application%0ARoute: /dashboard/applications/[id]/edit%0A%0APlease describe what you were trying to do:%0A- Application ID:%0A- Changes attempted:%0A- Error encountered:%0A`;
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

        {/* Application Editing Context */}
        <div className={styles.contextNotice}>
          <strong>✏️ Application Editing</strong>
          <p>
            This error occurred while trying to edit an application. Your
            existing application data is safe, but recent changes may not have
            been saved.
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
            Refresh Page
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
                <strong>Route:</strong> /dashboard/applications/[id]/edit
              </p>
              <p>
                <strong>Operation:</strong> Edit Application
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
