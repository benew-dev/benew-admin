// app/not-found.jsx - GLOBAL 404 PAGE
import Link from 'next/link';
import '@/ui/styling/not-found.css';

/**
 * GLOBAL NOT FOUND (404) PAGE - Server Component
 *
 * Production-ready 404 handler for admin app (5 users/day):
 * - Triggered when user navigates to non-existent route
 * - Server Component (no client JS overhead)
 * - Clear navigation back to safe routes
 * - Security: No path disclosure (prevents enumeration attacks)
 * - SEO: noindex, nofollow (admin routes shouldn't be indexed)
 *
 * When is this triggered?
 * - User types invalid URL manually
 * - Broken internal links (should fix during dev)
 * - Old bookmarks after route changes
 * - Typos in navigation
 *
 * IMPORTANT: For admin with 5 users/day:
 * - 404s should be RARE (users know the routes)
 * - If 404s are frequent → investigate broken links
 * - Monitor 404 rate in analytics (should be <1%)
 *
 * Note: Route-specific not-found.jsx can override this.
 * Example: app/dashboard/not-found.jsx for dashboard-specific 404
 */
export default function NotFound() {
  return (
    <div className="not-found-container">
      <div className="not-found-card">
        {/* 404 Icon/Number */}
        <div className="not-found-icon">404</div>

        {/* Title */}
        <h1 className="not-found-title">Page Not Found</h1>

        {/* Description */}
        <p className="not-found-description">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Please check the URL or navigate back to a safe location.
        </p>

        {/* Security Notice for Admin */}
        <div className="not-found-notice">
          <p>
            <strong>🔒 Admin Area</strong>
            <br />
            If you believe this page should exist, please contact your system
            administrator.
          </p>
        </div>

        {/* Quick Navigation Links */}
        <div className="not-found-actions">
          <Link href="/dashboard" className="btn btn-primary">
            Go to Dashboard
          </Link>

          <Link href="/login" className="btn btn-secondary">
            Back to Login
          </Link>
        </div>

        {/* Additional Help */}
        <div className="not-found-footer">
          <p className="help-text">
            Need help?{' '}
            <a href="mailto:support@benew.com" className="help-link">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ✅ Metadata for SEO and security
export const metadata = {
  title: '404 - Page Not Found | Benew Admin',
  description: 'The requested page could not be found.',
  robots: 'noindex, nofollow', // Never index 404 pages
};
