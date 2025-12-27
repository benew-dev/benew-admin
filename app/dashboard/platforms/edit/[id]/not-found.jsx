// app/dashboard/platforms/edit/[id]/not-found.jsx - PLATFORM NOT FOUND PAGE
import Link from 'next/link';
import styles from '@/ui/styling/dashboard/platforms/editNotFound.module.css';

/**
 * PLATFORM NOT FOUND (404) PAGE - Server Component
 *
 * Production-ready 404 handler for platform edit route (5 users/day):
 * - Triggered when platform ID doesn't exist in database
 * - Triggered when platform ID validation fails
 * - Server Component (no client JS overhead)
 * - Helpful navigation back to platforms list
 * - Security: No platform ID disclosure in error messages
 *
 * When is this triggered?
 * - /dashboard/platforms/edit/non-existent-uuid
 * - /dashboard/platforms/edit/invalid-id-format
 * - /dashboard/platforms/edit/deleted-platform-id
 * - Platform fetch returns null from database
 *
 * IMPORTANT: For admin with 5 users/day:
 * - Platform 404s should be RARE (admins know their platforms)
 * - If frequent → investigate UI bugs or database issues
 * - Monitor 404 rate (should be <1% of platform requests)
 *
 * Difference from platforms list not-found.jsx:
 * - This is for specific platform ID not found
 * - List not-found is for invalid /platforms/* routes
 * - Different messaging and context
 */
export default function PlatformNotFound() {
  return (
    <div className={styles.notFoundContainer}>
      <div className={styles.notFoundCard}>
        {/* 404 Icon */}
        <div className={styles.notFoundIcon}>🔍</div>

        {/* Title */}
        <h1 className={styles.notFoundTitle}>Payment Platform Not Found</h1>

        {/* Description */}
        <p className={styles.notFoundDescription}>
          The payment platform you&apos;re looking for doesn&apos;t exist or may
          have been deleted. Please check the platform ID or return to the
          platforms list.
        </p>

        {/* Context Notice */}
        <div className={styles.contextNotice}>
          <p>
            <strong>💡 Common Reasons:</strong>
          </p>
          <ul>
            <li>The platform may have been deleted by another administrator</li>
            <li>The platform ID in the URL might be incorrect or malformed</li>
            <li>You may have followed an outdated link or bookmark</li>
            <li>There could be a temporary database connectivity issue</li>
          </ul>
        </div>

        {/* Quick Actions */}
        <div className={styles.quickActions}>
          <h2 className={styles.quickActionsTitle}>
            What would you like to do?
          </h2>
          <div className={styles.actionsGrid}>
            <Link href="/dashboard/platforms" className={styles.actionCard}>
              <span className={styles.actionIcon}>💳</span>
              <span className={styles.actionLabel}>View All Platforms</span>
              <span className={styles.actionDescription}>
                Browse the complete list of payment platforms
              </span>
            </Link>

            <Link href="/dashboard/platforms/add" className={styles.actionCard}>
              <span className={styles.actionIcon}>➕</span>
              <span className={styles.actionLabel}>Create New Platform</span>
              <span className={styles.actionDescription}>
                Add a new payment platform to your collection
              </span>
            </Link>

            <Link href="/dashboard" className={styles.actionCard}>
              <span className={styles.actionIcon}>🏠</span>
              <span className={styles.actionLabel}>Go to Dashboard</span>
              <span className={styles.actionDescription}>
                Return to the main dashboard
              </span>
            </Link>
          </div>
        </div>

        {/* Help Footer */}
        <div className={styles.helpFooter}>
          <p className={styles.helpText}>
            If you believe this platform should exist, please{' '}
            <a href="mailto:support@benew.com" className={styles.helpLink}>
              contact support
            </a>{' '}
            with the platform ID from the URL.
          </p>
        </div>
      </div>
    </div>
  );
}

// ✅ Metadata for SEO and security
export const metadata = {
  title: '404 - Platform Not Found | Dashboard',
  description: 'The requested payment platform could not be found.',
  robots: 'noindex, nofollow',
};
