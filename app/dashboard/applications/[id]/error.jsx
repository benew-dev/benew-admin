// app/dashboard/applications/[id]/error.jsx - SINGLE APPLICATION ERROR BOUNDARY
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import styles from '@/ui/styling/dashboard/applications/singleError.module.css';

/**
 * SINGLE APPLICATION ERROR BOUNDARY - Client Component
 *
 * Production-ready error handling for single application view (5 users/day):
 * - Captures errors when fetching/displaying a single application
 * - Database fetch errors
 * - Rendering errors in SingleApplication component
 * - Automatic Sentry reporting with single application context
 * - Recovery actions specific to application viewing
 *
 * IMPORTANT: This catches errors in:
 * - Single application fetch from database
 * - SingleApplication component rendering
 * - Client-side operations (delete, etc.)
 * - Does NOT catch: Application not found (handled by not-found.jsx)
 */
export default function SingleApplicationError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    // ✅ Report error to Sentry with single application context
    Sentry.captureException(error, {
      tags: {
        component: 'single-application-error-boundary',
        area: 'applications-single',
        feature: 'application-view',
      },
      contexts: {
        error_info: {
          name: error.name || 'UnknownError',
          message: error.message || 'No error message',
        },
        applications: {
          route: '/dashboard/applications/[id]',
          operation: 'view',
        },
      },
    });

    // ✅ Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Single application error:', error);
    }
  }, [error]);

  // Determine error type for user-friendly messaging
  const getErrorInfo = () => {
    const errorMessage = error?.message?.toLowerCase() || '';

    // Database errors (most common for single application view)
    if (
      errorMessage.includes('database') ||
      errorMessage.includes('query') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('postgres')
    ) {
      return {
        title: 'Database Connection Error',
        description:
          'Unable to load application details from the database. This is usually temporary. Our team has been notified.',
        icon: '💾',
        showRetry: true,
        showGoToList: true,
        showGoToDashboard: false,
      };
    }

    // Network/fetch errors
    if (
      errorMessage.includes('fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout')
    ) {
      return {
        title: 'Network Error',
        description:
          'Unable to load application details due to a network issue. Please check your connection and try again.',
        icon: '🌐',
        showRetry: true,
        showGoToList: true,
        showGoToDashboard: false,
      };
    }

    // Auth/Session errors
    if (
      errorMessage.includes('auth') ||
      errorMessage.includes('session') ||
      errorMessage.includes('unauthorized')
    ) {
      return {
        title: 'Session Error',
        description:
          'Your session may have expired. Please refresh the page or log in again.',
        icon: '🔐',
        showRetry: false,
        showGoToList: true,
        showGoToDashboard: false,
      };
    }

    // Data parsing errors
    if (
      errorMessage.includes('json') ||
      errorMessage.includes('parse') ||
      errorMessage.includes('invalid')
    ) {
      return {
        title: 'Data Error',
        description:
          'There was a problem processing the application data. Please refresh the page.',
        icon: '⚠️',
        showRetry: true,
        showGoToList: true,
        showGoToDashboard: false,
      };
    }

    // Application not found (should be caught by not-found.jsx but just in case)
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return {
        title: 'Application Not Found',
        description:
          'The application you are trying to view no longer exists or has been deleted.',
        icon: '🔍',
        showRetry: false,
        showGoToList: true,
        showGoToDashboard: true,
      };
    }

    // Generic error
    return {
      title: 'Unable to Load Application',
      description:
        'An unexpected error occurred while loading application details. Our team has been notified.',
      icon: '❌',
      showRetry: true,
      showGoToList: true,
      showGoToDashboard: true,
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

    window.location.href = `mailto:support@benew.com?subject=Application View Error - Admin App&body=Error Reference: ${errorId}%0ATimestamp: ${timestamp}%0APage: Single Application View%0ARoute: /dashboard/applications/[id]%0A%0APlease describe what happened:`;
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

        {/* Application Context Notice */}
        <div className={styles.contextNotice}>
          <strong>📱 Application Details</strong>
          <p>
            This error occurred while trying to load or display application
            details. Your applications data is safe - this is just a temporary
            display issue.
          </p>
        </div>

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
                <strong>Route:</strong> /dashboard/applications/[id]
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
