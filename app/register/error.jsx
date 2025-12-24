// app/register/error.jsx - ERROR BOUNDARY
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import '@/ui/styling/register/error.css';

/**
 * REGISTRATION ERROR BOUNDARY - Client Component
 *
 * Production-ready error handling for admin registration (5 users/day):
 * - Captures unexpected errors during registration flow
 * - Automatic Sentry reporting with sanitized context
 * - User-friendly error messages (no technical jargon)
 * - Recovery actions: retry, go back, contact support
 * - Security: No sensitive data exposed in error messages
 *
 * IMPORTANT: This catches errors in:
 * - RegistrationForm component crashes
 * - Client-side JavaScript errors
 * - React rendering errors
 * - Does NOT catch: Server Component errors (use global error.jsx)
 */
export default function RegisterError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    // ✅ Report error to Sentry with sanitized context
    Sentry.captureException(error, {
      tags: {
        component: 'register-error-boundary',
        page: 'register',
      },
      contexts: {
        error_info: {
          name: error.name || 'UnknownError',
          message: error.message || 'No error message',
          // Don't include stack trace in context (already in exception)
        },
      },
    });

    // ✅ Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Registration page error:', error);
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
      };
    }

    // Auth-specific errors
    if (
      errorMessage.includes('auth') ||
      errorMessage.includes('session') ||
      errorMessage.includes('unauthorized')
    ) {
      return {
        title: 'Authentication Error',
        description:
          'There was a problem with the authentication system. Please try again or contact support.',
        icon: '🔐',
        showRetry: true,
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
          'Some of your registration data is invalid. Please check your inputs and try again.',
        icon: '⚠️',
        showRetry: true,
      };
    }

    // Rate limiting (though should be caught by form)
    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      return {
        title: 'Too Many Attempts',
        description:
          'You have made too many registration attempts. Please wait a few minutes before trying again.',
        icon: '⏱️',
        showRetry: false,
      };
    }

    // Generic error
    return {
      title: 'Something Went Wrong',
      description:
        'An unexpected error occurred during registration. Our team has been notified.',
      icon: '❌',
      showRetry: true,
    };
  };

  const errorInfo = getErrorInfo();

  const handleRetry = () => {
    reset(); // Attempt to recover by re-rendering
  };

  const handleGoBack = () => {
    router.push('/login');
  };

  const handleContactSupport = () => {
    // Generate error reference ID from Sentry event ID
    const errorId = Sentry.lastEventId() || 'N/A';

    // Redirect to support page or open email client
    window.location.href = `mailto:support@benew.com?subject=Registration Error&body=Error Reference: ${errorId}%0A%0APlease describe what happened:`;
  };

  return (
    <div className="error-container">
      <div className="error-card">
        {/* Icon */}
        <div className="error-icon">{errorInfo.icon}</div>

        {/* Title */}
        <h1 className="error-title">{errorInfo.title}</h1>

        {/* Description */}
        <p className="error-description">{errorInfo.description}</p>

        {/* Error Reference (for support) */}
        {Sentry.lastEventId() && (
          <div className="error-reference">
            <small>
              Error Reference: <code>{Sentry.lastEventId()}</code>
            </small>
          </div>
        )}

        {/* Action Buttons */}
        <div className="error-actions">
          {errorInfo.showRetry && (
            <button onClick={handleRetry} className="btn btn-primary">
              Try Again
            </button>
          )}

          <button onClick={handleGoBack} className="btn btn-secondary">
            Back to Login
          </button>

          <button onClick={handleContactSupport} className="btn btn-link">
            Contact Support
          </button>
        </div>

        {/* Developer Info (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="error-details">
            <summary>Developer Info (dev only)</summary>
            <pre className="error-stack">
              <strong>Error Name:</strong> {error.name || 'Unknown'}
              {'\n'}
              <strong>Error Message:</strong> {error.message || 'No message'}
              {'\n'}
              {error.stack && (
                <>
                  <strong>Stack Trace:</strong>
                  {'\n'}
                  {error.stack}
                </>
              )}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
