// app/login/error.jsx - ERROR BOUNDARY
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import '@/ui/styling/login/error.css';

/**
 * LOGIN ERROR BOUNDARY - Client Component
 *
 * Production-ready error handling for admin login (5 users/day):
 * - Captures unexpected errors during login flow
 * - Automatic Sentry reporting with sanitized context
 * - User-friendly error messages (no credentials exposed)
 * - Recovery actions: retry, register, contact support
 * - Security: Critical - no auth data exposed in error messages
 *
 * IMPORTANT: This catches errors in:
 * - LoginForm component crashes
 * - Client-side JavaScript errors
 * - React rendering errors
 * - Does NOT catch: Server Component errors (use global error.jsx)
 */
export default function LoginError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    // ✅ Report error to Sentry with sanitized context
    Sentry.captureException(error, {
      tags: {
        component: 'login-error-boundary',
        page: 'login',
        critical: 'true', // Login errors are critical for admin access
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
      console.error('Login page error:', error);
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
          'Unable to connect to the authentication server. Please check your internet connection and try again.',
        icon: '🌐',
        showRetry: true,
        showRegister: false,
      };
    }

    // Auth-specific errors (critical for login page)
    if (
      errorMessage.includes('auth') ||
      errorMessage.includes('session') ||
      errorMessage.includes('cookie') ||
      errorMessage.includes('unauthorized')
    ) {
      return {
        title: 'Authentication System Error',
        description:
          'There was a problem with the authentication system. This is likely temporary. Please try again in a few moments.',
        icon: '🔐',
        showRetry: true,
        showRegister: false,
      };
    }

    // Validation errors (shouldn't happen but handle gracefully)
    if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid')
    ) {
      return {
        title: 'Form Validation Error',
        description:
          'There was a problem validating your login information. Please refresh the page and try again.',
        icon: '⚠️',
        showRetry: true,
        showRegister: false,
      };
    }

    // Rate limiting (though should be caught by form)
    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      return {
        title: 'Too Many Login Attempts',
        description:
          'You have made too many login attempts. Please wait 10-15 minutes before trying again.',
        icon: '⏱️',
        showRetry: false,
        showRegister: false,
      };
    }

    // Database/Server errors
    if (
      errorMessage.includes('database') ||
      errorMessage.includes('server') ||
      errorMessage.includes('500')
    ) {
      return {
        title: 'Server Error',
        description:
          'Our servers are experiencing issues. Our team has been notified and is working on a fix. Please try again in a few minutes.',
        icon: '🔧',
        showRetry: true,
        showRegister: false,
      };
    }

    // Generic error
    return {
      title: 'Something Went Wrong',
      description:
        'An unexpected error occurred during login. Our team has been notified. Please try again or contact support if the problem persists.',
      icon: '❌',
      showRetry: true,
      showRegister: true,
    };
  };

  const errorInfo = getErrorInfo();

  const handleRetry = () => {
    reset(); // Attempt to recover by re-rendering
  };

  const handleGoToRegister = () => {
    router.push('/register');
  };

  const handleContactSupport = () => {
    // Generate error reference ID from Sentry event ID
    const errorId = Sentry.lastEventId() || 'N/A';

    // Redirect to support page or open email client
    window.location.href = `mailto:support@benew.com?subject=Login Error - Admin Access&body=Error Reference: ${errorId}%0A%0APlease describe what happened when you tried to login:`;
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

        {/* Security Notice for Admin */}
        <div className="security-notice">
          <strong>🔒 Admin Access</strong>
          <p>
            Login errors are monitored for security. If you&apos;re experiencing
            persistent issues, contact your administrator.
          </p>
        </div>

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

          {errorInfo.showRegister && (
            <button onClick={handleGoToRegister} className="btn btn-secondary">
              Create Account
            </button>
          )}

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
