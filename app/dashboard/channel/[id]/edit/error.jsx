// app/dashboard/channel/[id]/edit/error.jsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import styles from '@/ui/styling/dashboard/channel/edit/editError.module.css';

export default function EditVideoError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        component: 'edit-video-error-boundary',
        area: 'channel-edit',
        feature: 'video-editing',
        critical: 'true',
      },
      contexts: {
        error_info: {
          name: error.name || 'UnknownError',
          message: error.message || 'No error message',
        },
        channel: {
          route: '/dashboard/channel/[id]/edit',
          operation: 'edit',
        },
      },
    });

    if (process.env.NODE_ENV === 'development') {
      console.error('Edit video error:', error);
    }
  }, [error]);

  const getErrorInfo = () => {
    const errorMessage = error?.message?.toLowerCase() || '';

    if (
      errorMessage.includes('database') ||
      errorMessage.includes('query') ||
      errorMessage.includes('postgres') ||
      errorMessage.includes('connection')
    ) {
      return {
        title: 'Database Error',
        description:
          'Unable to load or update the video data. This could be a temporary database issue. Our team has been notified.',
        icon: '💾',
        showRetry: true,
        showGoToList: true,
        showGoToDashboard: false,
        advice:
          'Your changes may not have been saved. Please try again in a moment.',
      };
    }

    if (
      errorMessage.includes('cloudinary') ||
      errorMessage.includes('upload') ||
      errorMessage.includes('signature')
    ) {
      return {
        title: 'Upload Failed',
        description:
          'There was a problem uploading your video or thumbnail to Cloudinary. This could be a temporary network issue.',
        icon: '📤',
        showRetry: true,
        showGoToList: true,
        showGoToDashboard: false,
        advice:
          'Existing video assets are safe. Try uploading again or use a smaller file.',
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
        showGoToDashboard: false,
        advice: 'Your changes may not have been saved.',
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
          'Some video information is invalid or missing. Please check your inputs and try again.',
        icon: '⚠️',
        showRetry: true,
        showGoToList: false,
        showGoToDashboard: false,
        advice:
          'Make sure title (min 3 chars), category, and level are correctly filled.',
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
          'Your session has expired. Please refresh the page and log in again to continue editing.',
        icon: '🔐',
        showRetry: false,
        showGoToList: true,
        showGoToDashboard: false,
        advice:
          'You will need to log in again. Your unsaved changes will be lost.',
      };
    }

    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      return {
        title: 'Too Many Requests',
        description:
          'You have made too many update attempts. Please wait a few minutes before trying again.',
        icon: '⏱️',
        showRetry: false,
        showGoToList: true,
        showGoToDashboard: false,
        advice: 'Rate limit will reset in a few minutes.',
      };
    }

    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return {
        title: 'Video Not Found',
        description:
          'The video you are trying to edit no longer exists or has been deleted.',
        icon: '🔍',
        showRetry: false,
        showGoToList: true,
        showGoToDashboard: true,
        advice: 'The video may have been deleted by another administrator.',
      };
    }

    return {
      title: 'Failed to Edit Video',
      description:
        'An unexpected error occurred while editing the video. Our team has been notified. Please try again or contact support if the problem persists.',
      icon: '❌',
      showRetry: true,
      showGoToList: true,
      showGoToDashboard: true,
      advice:
        'If this error persists, try refreshing the page or clearing your browser cache.',
    };
  };

  const errorInfo = getErrorInfo();

  const handleContactSupport = () => {
    const errorId = Sentry.lastEventId() || 'N/A';
    const timestamp = new Date().toISOString();
    window.location.href = `mailto:support@benew.com?subject=Edit Video Error - Admin App&body=Error Reference: ${errorId}%0ATimestamp: ${timestamp}%0APage: Edit Video%0ARoute: /dashboard/channel/[id]/edit%0A%0APlease describe what you were trying to do:%0A`;
  };

  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorCard}>
        <div className={styles.errorIcon}>{errorInfo.icon}</div>

        <h1 className={styles.errorTitle}>{errorInfo.title}</h1>
        <p className={styles.errorDescription}>{errorInfo.description}</p>

        <div className={styles.contextNotice}>
          <strong>✏️ Video Editing</strong>
          <p>
            This error occurred while trying to edit a video. Your existing
            video data is safe, but recent changes may not have been saved.
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
                <strong>Route:</strong> /dashboard/channel/[id]/edit
              </p>
              <p>
                <strong>Operation:</strong> Edit Video
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
