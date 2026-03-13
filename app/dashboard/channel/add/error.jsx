// app/dashboard/channel/add/error.jsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import styles from '@/ui/styling/dashboard/channel/add/addError.module.css';

export default function AddVideoError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        component: 'add-video-error-boundary',
        area: 'channel-add',
        feature: 'video-creation',
        critical: 'true',
      },
      contexts: {
        error_info: {
          name: error.name || 'UnknownError',
          message: error.message || 'No error message',
        },
        channel: {
          route: '/dashboard/channel/add',
          operation: 'create',
        },
      },
    });

    if (process.env.NODE_ENV === 'development') {
      console.error('Add video error:', error);
    }
  }, [error]);

  const getErrorInfo = () => {
    const errorMessage = error?.message?.toLowerCase() || '';

    if (
      errorMessage.includes('cloudinary') ||
      errorMessage.includes('upload') ||
      errorMessage.includes('signature')
    ) {
      return {
        title: 'Video Upload Failed',
        description:
          'There was a problem uploading your video to Cloudinary. This could be a temporary network issue or a problem with the upload service.',
        icon: '📤',
        showRetry: true,
        showGoToList: true,
        advice:
          'Try uploading a smaller file or check your internet connection. Max size is 500MB.',
      };
    }

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
        advice: 'Your video data has not been saved. Please try again.',
      };
    }

    if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('required')
    ) {
      return {
        title: 'Form Validation Error',
        description:
          'Some of the video information is invalid or missing. Please check your inputs and try again.',
        icon: '⚠️',
        showRetry: true,
        showGoToList: false,
        advice:
          'Make sure all required fields are filled: title, video file, category, and level (1-5).',
      };
    }

    if (
      errorMessage.includes('database') ||
      errorMessage.includes('query') ||
      errorMessage.includes('postgres')
    ) {
      return {
        title: 'Database Error',
        description:
          'Unable to save the video to the database. Our team has been notified.',
        icon: '💾',
        showRetry: true,
        showGoToList: true,
        advice:
          'Your video may have been uploaded to Cloudinary. Please wait before trying again.',
      };
    }

    if (
      errorMessage.includes('auth') ||
      errorMessage.includes('session') ||
      errorMessage.includes('unauthorized')
    ) {
      return {
        title: 'Session Expired',
        description:
          'Your session has expired. Please refresh the page and log in again.',
        icon: '🔐',
        showRetry: false,
        showGoToList: true,
        advice: 'You will need to log in again before adding videos.',
      };
    }

    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      return {
        title: 'Too Many Requests',
        description:
          'You have made too many upload attempts. Please wait a few minutes before trying again.',
        icon: '⏱️',
        showRetry: false,
        showGoToList: true,
        advice: 'Rate limit will reset in 5 minutes.',
      };
    }

    return {
      title: 'Failed to Add Video',
      description:
        'An unexpected error occurred while creating the video. Our team has been notified. Please try again.',
      icon: '❌',
      showRetry: true,
      showGoToList: true,
      advice:
        'If this error persists, try refreshing the page or clearing your browser cache.',
    };
  };

  const errorInfo = getErrorInfo();

  const handleContactSupport = () => {
    const errorId = Sentry.lastEventId() || 'N/A';
    const timestamp = new Date().toISOString();
    window.location.href = `mailto:support@benew.com?subject=Add Video Error - Admin App&body=Error Reference: ${errorId}%0ATimestamp: ${timestamp}%0APage: Add Video%0ARoute: /dashboard/channel/add%0A%0APlease describe what you were trying to do:%0A`;
  };

  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorCard}>
        <div className={styles.errorIcon}>{errorInfo.icon}</div>

        <h1 className={styles.errorTitle}>{errorInfo.title}</h1>
        <p className={styles.errorDescription}>{errorInfo.description}</p>

        <div className={styles.contextNotice}>
          <strong>🎬 Video Creation</strong>
          <p>
            This error occurred while trying to add a new video to the channel.
            Your form data may not have been saved.
          </p>
        </div>

        {errorInfo.advice && (
          <div className={styles.adviceBox}>
            <strong>💡 Tip:</strong>
            <p>{errorInfo.advice}</p>
          </div>
        )}

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
            Refresh Form
          </button>

          {errorInfo.showGoToList && (
            <button
              onClick={() => router.push('/dashboard/channel')}
              className={styles.btnSecondary}
            >
              Back to Videos List
            </button>
          )}

          <button
            onClick={() => router.push('/dashboard')}
            className={styles.btnLink}
          >
            Go to Dashboard
          </button>

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
                <strong>Route:</strong> /dashboard/channel/add
              </p>
              <p>
                <strong>Operation:</strong> Create Video
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
