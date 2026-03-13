// app/dashboard/channel/error.jsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import styles from '@/ui/styling/dashboard/channel/error.module.css';

export default function ChannelError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        component: 'channel-error-boundary',
        area: 'channel-list',
        feature: 'channel',
      },
      contexts: {
        error_info: {
          name: error.name || 'UnknownError',
          message: error.message || 'No error message',
        },
        channel: {
          route: '/dashboard/channel',
          operation: 'list',
        },
      },
    });

    if (process.env.NODE_ENV === 'development') {
      console.error('Channel list error:', error);
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
          'Unable to load videos from the database. This is usually temporary. Our team has been notified.',
        icon: '💾',
        showRetry: true,
        showAddNew: false,
        showGoToDashboard: true,
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
          'Unable to load videos due to a network issue. Please check your connection and try again.',
        icon: '🌐',
        showRetry: true,
        showAddNew: false,
        showGoToDashboard: true,
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
        showAddNew: false,
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
          'There was a problem processing the videos data. Please refresh the page.',
        icon: '⚠️',
        showRetry: true,
        showAddNew: false,
        showGoToDashboard: true,
      };
    }

    return {
      title: 'Unable to Load Videos',
      description:
        'An unexpected error occurred while loading videos. Our team has been notified. You can try adding a new video or return to the dashboard.',
      icon: '❌',
      showRetry: true,
      showAddNew: true,
      showGoToDashboard: true,
    };
  };

  const errorInfo = getErrorInfo();

  const handleContactSupport = () => {
    const errorId = Sentry.lastEventId() || 'N/A';
    const timestamp = new Date().toISOString();
    window.location.href = `mailto:support@benew.com?subject=Channel Error - Admin App&body=Error Reference: ${errorId}%0ATimestamp: ${timestamp}%0APage: Videos List%0ARoute: /dashboard/channel%0A%0APlease describe what happened:`;
  };

  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorCard}>
        <div className={styles.errorIcon}>{errorInfo.icon}</div>

        <h1 className={styles.errorTitle}>{errorInfo.title}</h1>
        <p className={styles.errorDescription}>{errorInfo.description}</p>

        <div className={styles.contextNotice}>
          <strong>🎬 Channel Module</strong>
          <p>
            This error occurred while trying to load or display your video
            catalog. Your videos data is safe - this is just a temporary display
            issue.
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

          {errorInfo.showAddNew && (
            <button
              onClick={() => router.push('/dashboard/channel/add')}
              className={styles.btnSecondary}
            >
              + Add New Video
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
                <strong>Route:</strong> /dashboard/channel
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
