// app/dashboard/channel/[id]/error.jsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import styles from '@/ui/styling/dashboard/channel/singleError.module.css';

export default function SingleVideoError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        component: 'single-video-error-boundary',
        area: 'channel-single',
        feature: 'video-view',
      },
      contexts: {
        error_info: {
          name: error.name || 'UnknownError',
          message: error.message || 'No error message',
        },
        channel: {
          route: '/dashboard/channel/[id]',
          operation: 'view',
        },
      },
    });

    if (process.env.NODE_ENV === 'development') {
      console.error('Single video error:', error);
    }
  }, [error]);

  const getErrorInfo = () => {
    const errorMessage = error?.message?.toLowerCase() || '';

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
          'Unable to load video details from the database. This is usually temporary. Our team has been notified.',
        icon: '💾',
        showRetry: true,
        showGoToList: true,
        showGoToDashboard: false,
      };
    }

    if (
      errorMessage.includes('fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout')
    ) {
      return {
        title: 'Network Error',
        description:
          'Unable to load video details due to a network issue. Please check your connection and try again.',
        icon: '🌐',
        showRetry: true,
        showGoToList: true,
        showGoToDashboard: false,
      };
    }

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

    if (
      errorMessage.includes('json') ||
      errorMessage.includes('parse') ||
      errorMessage.includes('invalid')
    ) {
      return {
        title: 'Data Error',
        description:
          'There was a problem processing the video data. Please refresh the page.',
        icon: '⚠️',
        showRetry: true,
        showGoToList: true,
        showGoToDashboard: false,
      };
    }

    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return {
        title: 'Video Not Found',
        description:
          'The video you are trying to view no longer exists or has been deleted.',
        icon: '🔍',
        showRetry: false,
        showGoToList: true,
        showGoToDashboard: true,
      };
    }

    return {
      title: 'Unable to Load Video',
      description:
        'An unexpected error occurred while loading video details. Our team has been notified.',
      icon: '❌',
      showRetry: true,
      showGoToList: true,
      showGoToDashboard: true,
    };
  };

  const errorInfo = getErrorInfo();

  const handleContactSupport = () => {
    const errorId = Sentry.lastEventId() || 'N/A';
    const timestamp = new Date().toISOString();
    window.location.href = `mailto:support@benew.com?subject=Video View Error - Admin App&body=Error Reference: ${errorId}%0ATimestamp: ${timestamp}%0APage: Single Video View%0ARoute: /dashboard/channel/[id]%0A%0APlease describe what happened:`;
  };

  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorCard}>
        <div className={styles.errorIcon}>{errorInfo.icon}</div>

        <h1 className={styles.errorTitle}>{errorInfo.title}</h1>
        <p className={styles.errorDescription}>{errorInfo.description}</p>

        <div className={styles.contextNotice}>
          <strong>🎬 Video Details</strong>
          <p>
            This error occurred while trying to load or display video details.
            Your videos data is safe - this is just a temporary display issue.
          </p>
        </div>

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

        <div className={styles.errorActions}>
          {errorInfo.showRetry && (
            <button onClick={reset} className={styles.btnPrimary}>
              Try Again
            </button>
          )}

          <button
            onClick={() => router.refresh()}
            className={styles.btnSecondary}
          >
            Refresh Page
          </button>

          {errorInfo.showGoToList && (
            <button
              onClick={() => router.push('/dashboard/channel')}
              className={styles.btnSecondary}
            >
              Back to Videos List
            </button>
          )}

          {errorInfo.showGoToDashboard && (
            <button
              onClick={() => router.push('/dashboard')}
              className={styles.btnLink}
            >
              Go to Dashboard
            </button>
          )}

          <button onClick={handleContactSupport} className={styles.btnLink}>
            Contact Support
          </button>
        </div>

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
                <strong>Route:</strong> /dashboard/channel/[id]
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
