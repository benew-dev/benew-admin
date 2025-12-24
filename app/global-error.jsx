// app/global-error.jsx - GLOBAL ERROR BOUNDARY
'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import '@/styling/global-error.css';

/**
 * GLOBAL ERROR BOUNDARY - Client Component
 *
 * Production-ready global error handler for admin app (5 users/day):
 * - Catches ALL unhandled errors in the entire application
 * - Last line of defense before white screen of death
 * - Only triggered for catastrophic failures (root layout errors)
 * - Automatic Sentry reporting with maximum priority
 * - Minimal UI (no dependencies, pure HTML/CSS)
 *
 * CRITICAL DIFFERENCES vs route-level error.jsx:
 * - This catches errors in root layout.js
 * - Must redefine <html> and <body> tags
 * - Cannot use Next.js components (Link, Image, etc.)
 * - Should be EXTREMELY simple and failsafe
 *
 * When is this triggered?
 * - Root layout crashes
 * - Critical runtime errors outside route boundaries
 * - Errors in error.jsx files themselves
 * - Server component errors that bubble up
 *
 * IMPORTANT: This is a last resort fallback.
 * Most errors should be caught by route-level error.jsx files.
 */
// eslint-disable-next-line no-unused-vars
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // ✅ Report to Sentry with CRITICAL priority
    Sentry.captureException(error, {
      level: 'fatal', // Highest severity
      tags: {
        component: 'global-error-boundary',
        catastrophic: 'true',
        admin_app: 'true',
      },
      contexts: {
        error_info: {
          name: error?.name || 'CatastrophicError',
          message: error?.message || 'No error message available',
          // Stack trace is automatically included by captureException
        },
        application: {
          type: 'admin_dashboard',
          max_users: 5,
          critical_failure: true,
        },
      },
    });

    // ✅ Log to console (always, even in production)
    console.error('[CRITICAL] Global error boundary triggered:', error);

    // ✅ Alert development team immediately
    if (process.env.NODE_ENV === 'production') {
      // In production, you might want to send an immediate alert
      // Example: PagerDuty, Slack webhook, SMS, etc.
      console.error('[ALERT] PRODUCTION CRITICAL ERROR - Admin app down');
    }
  }, [error]);

  const handleReload = () => {
    // Hard reload the entire application
    window.location.href = '/';
  };

  const handleContactEmergency = () => {
    const errorId = Sentry.lastEventId() || 'UNKNOWN';
    const timestamp = new Date().toISOString();

    window.location.href = `mailto:emergency@benew.com?subject=CRITICAL: Admin App Failure&body=CRITICAL ERROR REPORT%0A%0AError ID: ${errorId}%0ATimestamp: ${timestamp}%0A%0AThe admin application has experienced a catastrophic failure.%0APlease investigate immediately.%0A%0AError: ${encodeURIComponent(error?.message || 'Unknown error')}`;
  };

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>Critical Error - Admin Dashboard</title>
      </head>
      <body>
        <div className="global-error-container">
          <div className="global-error-card">
            {/* Critical Icon */}
            <div className="global-error-icon">🚨</div>

            {/* Title */}
            <h1 className="global-error-title">Critical System Error</h1>

            {/* Description */}
            <p className="global-error-description">
              The admin dashboard has encountered a critical error and cannot
              continue. This issue has been automatically reported to our
              technical team.
            </p>

            {/* Alert Box */}
            <div className="global-error-alert">
              <strong>⚠️ Action Required</strong>
              <p>
                If you are an administrator, please contact technical support
                immediately. This is a high-priority incident.
              </p>
            </div>

            {/* Error Reference */}
            {Sentry.lastEventId() && (
              <div className="global-error-reference">
                <small>
                  Critical Error ID: <code>{Sentry.lastEventId()}</code>
                </small>
                <br />
                <small className="timestamp">
                  Time: {new Date().toLocaleString()}
                </small>
              </div>
            )}

            {/* Action Buttons */}
            <div className="global-error-actions">
              <button onClick={handleReload} className="btn btn-primary">
                Reload Application
              </button>

              <button
                onClick={handleContactEmergency}
                className="btn btn-danger"
              >
                Contact Emergency Support
              </button>
            </div>

            {/* Status Dashboard Link */}
            <div className="global-error-footer">
              <p>
                Check system status:{' '}
                <a href="https://status.benew.com" className="status-link">
                  status.benew.com
                </a>
              </p>
            </div>

            {/* Developer Info (Development Only) */}
            {process.env.NODE_ENV === 'development' && (
              <details className="global-error-details">
                <summary>Developer Debug Info (dev only)</summary>
                <div className="debug-info">
                  <p>
                    <strong>Error Name:</strong> {error?.name || 'Unknown'}
                  </p>
                  <p>
                    <strong>Error Message:</strong>{' '}
                    {error?.message || 'No message'}
                  </p>
                  {error?.digest && (
                    <p>
                      <strong>Error Digest:</strong> {error.digest}
                    </p>
                  )}
                  {error?.stack && (
                    <pre className="error-stack">{error.stack}</pre>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
