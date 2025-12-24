// app/dashboard/error.jsx - DASHBOARD ERROR BOUNDARY
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import styles from '@/ui/styling/dashboard/error.module.css';

/**
 * DASHBOARD ERROR BOUNDARY - Client Component
 *
 * Production-ready error handling for dashboard routes (5 users/day):
 * - Captures unexpected errors within dashboard pages
 * - Automatic Sentry reporting with sanitized context
 * - User-friendly error messages (no technical jargon)
 * - Recovery actions: retry, refresh, go home, contact support
 * - Security: No sensitive dashboard data exposed in error messages
 *
 * IMPORTANT: This catches errors in:
 * - Dashboard page components
 * - Dashboard Client Components
 * - React rendering errors in dashboard
 * - Does NOT catch: Root layout errors (use global-error.jsx)
 */
export default function DashboardError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    // ✅ Report error to Sentry with dashboard context
    Sentry.captureException(error, {
      tags: {
        component: 'dashboard-error-boundary',
        area: 'dashboard',
        critical: 'true', // Dashboard errors affect core admin functionality
      },
      contexts: {
        error_info: {
          name: error.name || 'UnknownError',
          message: error.message || 'No error message',
        },
        dashboard: {
          route: window.location.pathname,
          admin_app: true,
        },
      },
    });

    // ✅ Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Dashboard error:', error);
    }
  }, [error]);

  // Determine error type for user-friendly messaging
  const getErrorInfo = () => {
    const errorMessage = error?.message?.toLowerCase() || '';

    // Network errors
    if (
      errorMessage.includes('fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('connection')
    ) {
      return {
        title: 'Connection Error',
        description:
          'Unable to connect to the server. Please check your internet connection and try again.',
        icon: '🌐',
        showRetry: true,
        showRefresh: false,
      };
    }

    // Auth/Session errors (should be rare - middleware catches most)
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
        showRefresh: true,
      };
    }

    // Database errors
    if (
      errorMessage.includes('database') ||
      errorMessage.includes('query') ||
      errorMessage.includes('sql')
    ) {
      return {
        title: 'Data Error',
        description:
          'There was a problem loading the dashboard data. Our team has been notified. Please try again in a moment.',
        icon: '💾',
        showRetry: true,
        showRefresh: false,
      };
    }

    // Validation errors
    if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid')
    ) {
      return {
        title: 'Validation Error',
        description:
          'Some data could not be validated. Please refresh the page and try again.',
        icon: '⚠️',
        showRetry: true,
        showRefresh: true,
      };
    }

    // Server errors
    if (
      errorMessage.includes('server') ||
      errorMessage.includes('500') ||
      errorMessage.includes('503')
    ) {
      return {
        title: 'Server Error',
        description:
          'Our servers are experiencing issues. Our team has been notified and is working on a fix.',
        icon: '🔧',
        showRetry: true,
        showRefresh: false,
      };
    }

    // Generic error
    return {
      title: 'Something Went Wrong',
      description:
        'An unexpected error occurred in the dashboard. Our team has been notified. Please try again or contact support if the problem persists.',
      icon: '❌',
      showRetry: true,
      showRefresh: true,
    };
  };

  const errorInfo = getErrorInfo();

  const handleRetry = () => {
    reset(); // Attempt to recover by re-rendering
  };

  const handleRefresh = () => {
    router.refresh(); // Hard refresh the current route
  };

  const handleGoHome = () => {
    router.push('/dashboard');
  };

  const handleContactSupport = () => {
    const errorId = Sentry.lastEventId() || 'N/A';
    const timestamp = new Date().toISOString();

    window.location.href = `mailto:support@benew.com?subject=Dashboard Error - Admin App&body=Error Reference: ${errorId}%0ATimestamp: ${timestamp}%0APage: ${encodeURIComponent(window.location.pathname)}%0A%0APlease describe what you were doing when the error occurred:`;
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

        {/* Admin Notice */}
        <div className={styles.adminNotice}>
          <strong>🔒 Admin Dashboard</strong>
          <p>
            This error has been automatically reported to the technical team.
            You can continue working on other parts of the dashboard while we
            investigate.
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

          {errorInfo.showRefresh && (
            <button onClick={handleRefresh} className={styles.btnSecondary}>
              Refresh Page
            </button>
          )}

          <button onClick={handleGoHome} className={styles.btnSecondary}>
            Go to Dashboard Home
          </button>

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
