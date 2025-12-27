// app/dashboard/platforms/add/error.jsx - ADD PLATFORM ERROR BOUNDARY
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import styles from '@/ui/styling/dashboard/platforms/add/addError.module.css';

/**
 * ADD PLATFORM ERROR BOUNDARY - Client Component
 *
 * Production-ready error handling for add platform page (5 users/day):
 * - Captures errors during platform creation workflow
 * - Form validation errors
 * - API submission errors
 * - Database constraint violations
 * - Automatic Sentry reporting with add platform context
 * - Recovery actions specific to platform creation
 *
 * IMPORTANT: This catches errors in:
 * - AddPlatform component
 * - Form validation
 * - API submission
 * - Does NOT catch: Platforms list errors (parent error.jsx)
 */
export default function AddPlatformError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    // ✅ Report error to Sentry with add platform context
    Sentry.captureException(error, {
      tags: {
        component: 'add-platform-error-boundary',
        area: 'platforms-add',
        feature: 'platform-creation',
        critical: 'true', // Platform creation errors are critical
      },
      contexts: {
        error_info: {
          name: error.name || 'UnknownError',
          message: error.message || 'No error message',
        },
        platforms: {
          route: '/dashboard/platforms/add',
          operation: 'create',
        },
      },
    });

    // ✅ Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Add platform error:', error);
    }
  }, [error]);

  // Determine error type for user-friendly messaging
  const getErrorInfo = () => {
    const errorMessage = error?.message?.toLowerCase() || '';

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
        advice: 'Your platform data has not been saved. Please try again.',
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
          'Some of the platform information is invalid or missing. Please check your inputs and try again.',
        icon: '⚠️',
        showRetry: true,
        showGoToList: false,
        showGoToDashboard: false,
        advice:
          'Make sure all required fields are filled. For electronic platforms, account name and number are required. For cash payment, only platform name is required.',
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
          'Unable to save the platform to the database. Our team has been notified and is investigating.',
        icon: '💾',
        showRetry: true,
        showGoToList: true,
        showGoToDashboard: false,
        advice: 'Please wait a moment before trying again.',
      };
    }

    // Uniqueness constraint violation (duplicate platform name)
    if (errorMessage.includes('unique') || errorMessage.includes('duplicate')) {
      return {
        title: 'Duplicate Platform',
        description:
          'A payment platform with this name already exists. Please choose a different name.',
        icon: '🔄',
        showRetry: true,
        showGoToList: true,
        showGoToDashboard: false,
        advice: 'Platform names must be unique in the system.',
      };
    }

    // Check constraint violation (cash payment with account info)
    if (errorMessage.includes('constraint') || errorMessage.includes('check')) {
      return {
        title: 'Data Constraint Error',
        description:
          'The platform data violates business rules. Cash payments cannot have account information.',
        icon: '🚫',
        showRetry: true,
        showGoToList: false,
        showGoToDashboard: false,
        advice:
          'If cash payment is selected, do not provide account name or number. If electronic, both account fields are required.',
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
        advice: 'You will need to log in again before adding platforms.',
      };
    }

    // Rate limit errors
    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      return {
        title: 'Too Many Requests',
        description:
          'You have made too many platform creation attempts. Please wait a few minutes before trying again.',
        icon: '⏱️',
        showRetry: false,
        showGoToList: true,
        showGoToDashboard: false,
        advice: 'Rate limit will reset in 10 minutes.',
      };
    }

    // Generic error
    return {
      title: 'Failed to Add Platform',
      description:
        'An unexpected error occurred while creating the platform. Our team has been notified. Please try again or contact support if the problem persists.',
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
    router.push('/dashboard/platforms');
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  const handleContactSupport = () => {
    const errorId = Sentry.lastEventId() || 'N/A';
    const timestamp = new Date().toISOString();

    window.location.href = `mailto:support@benew.com?subject=Add Platform Error - Admin App&body=Error Reference: ${errorId}%0ATimestamp: ${timestamp}%0APage: Add Payment Platform%0ARoute: /dashboard/platforms/add%0A%0APlease describe what you were trying to do:%0A- Platform name:%0A- Platform type (Cash/Electronic):%0A- Error encountered:%0A`;
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

        {/* Platform Creation Context */}
        <div className={styles.contextNotice}>
          <strong>➕ Platform Creation</strong>
          <p>
            This error occurred while trying to create a new payment platform.
            Your form data may not have been saved.
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
              Back to Platforms List
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
                <strong>Route:</strong> /dashboard/platforms/add
              </p>
              <p>
                <strong>Operation:</strong> Create Payment Platform
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
