// app/dashboard/templates/error.jsx - TEMPLATES LIST ERROR BOUNDARY
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import styles from '@/ui/styling/dashboard/templates/error.module.css';

/**
 * TEMPLATES LIST ERROR BOUNDARY - Client Component
 *
 * Production-ready error handling for templates list page (5 users/day):
 * - Captures errors when fetching/displaying templates
 * - Database connection errors
 * - Rendering errors in ListTemplates component
 * - Automatic Sentry reporting with templates context
 * - Recovery actions specific to templates workflow
 *
 * IMPORTANT: This catches errors in:
 * - Templates fetch from database
 * - ListTemplates component rendering
 * - Client-side template operations (delete, etc.)
 * - Does NOT catch: Add template errors (has its own error.jsx)
 */
export default function TemplatesError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    // ✅ Report error to Sentry with templates context
    Sentry.captureException(error, {
      tags: {
        component: 'templates-error-boundary',
        area: 'templates-list',
        feature: 'templates',
      },
      contexts: {
        error_info: {
          name: error.name || 'UnknownError',
          message: error.message || 'No error message',
        },
        templates: {
          route: '/dashboard/templates',
          operation: 'list',
        },
      },
    });

    // ✅ Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Templates list error:', error);
    }
  }, [error]);

  // Determine error type for user-friendly messaging
  const getErrorInfo = () => {
    const errorMessage = error?.message?.toLowerCase() || '';

    // Database errors (most common for templates list)
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
          'Unable to load templates from the database. This is usually temporary. Our team has been notified.',
        icon: '💾',
        showRetry: true,
        showAddNew: false,
        showGoToDashboard: true,
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
          'Unable to load templates due to a network issue. Please check your connection and try again.',
        icon: '🌐',
        showRetry: true,
        showAddNew: false,
        showGoToDashboard: true,
      };
    }

    // Auth/Session errors (redirected from middleware usually)
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
        showAddNew: false,
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
          'There was a problem processing the templates data. Please refresh the page.',
        icon: '⚠️',
        showRetry: true,
        showAddNew: false,
        showGoToDashboard: true,
      };
    }

    // Generic error
    return {
      title: 'Unable to Load Templates',
      description:
        'An unexpected error occurred while loading templates. Our team has been notified. You can try creating a new template or return to the dashboard.',
      icon: '❌',
      showRetry: true,
      showAddNew: true,
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

  const handleAddNew = () => {
    router.push('/dashboard/templates/add');
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  const handleContactSupport = () => {
    const errorId = Sentry.lastEventId() || 'N/A';
    const timestamp = new Date().toISOString();

    window.location.href = `mailto:support@benew.com?subject=Templates Error - Admin App&body=Error Reference: ${errorId}%0ATimestamp: ${timestamp}%0APage: Templates List%0ARoute: /dashboard/templates%0A%0APlease describe what happened:`;
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

        {/* Templates Context Notice */}
        <div className={styles.contextNotice}>
          <strong>📋 Templates Module</strong>
          <p>
            This error occurred while trying to load or display your templates.
            Your templates data is safe - this is just a temporary display
            issue.
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

          {errorInfo.showAddNew && (
            <button onClick={handleAddNew} className={styles.btnSecondary}>
              + Add New Template
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
                <strong>Route:</strong> /dashboard/templates
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
