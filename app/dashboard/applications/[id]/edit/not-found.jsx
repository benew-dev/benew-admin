// app/dashboard/applications/[id]/edit/not-found.jsx - EDIT APPLICATION NOT FOUND
import Link from 'next/link';
import styles from '@/ui/styling/dashboard/applications/edit/editNotFound.module.css';

/**
 * EDIT APPLICATION NOT FOUND (404) PAGE - Server Component
 *
 * Production-ready 404 handler for edit application route (5 users/day):
 * - Triggered when application ID doesn't exist in database
 * - Triggered when application ID validation fails
 * - Server Component (no client JS overhead)
 * - Helpful navigation back to applications list
 * - Security: No application ID disclosure in error messages
 *
 * When is this triggered?
 * - /dashboard/applications/non-existent-uuid/edit
 * - /dashboard/applications/invalid-id-format/edit
 * - /dashboard/applications/deleted-application-id/edit
 * - Application fetch returns null from database
 *
 * IMPORTANT: For admin with 5 users/day:
 * - Application 404s should be RARE (admins know their applications)
 * - If frequent → investigate UI bugs or database issues
 * - Monitor 404 rate (should be <1% of application requests)
 */
export default function EditApplicationNotFound() {
  return (
    <div className={styles.notFoundContainer}>
      <div className={styles.notFoundCard}>
        {/* 404 Icon */}
        <div className={styles.notFoundIcon}>🔍</div>

        {/* Title */}
        <h1 className={styles.notFoundTitle}>Application Not Found</h1>

        {/* Description */}
        <p className={styles.notFoundDescription}>
          The application you&apos;re trying to edit doesn&apos;t exist or may
          have been deleted. Please check the application ID or return to the
          applications list.
        </p>

        {/* Context Notice */}
        <div className={styles.contextNotice}>
          <p>
            <strong>💡 Common Reasons:</strong>
          </p>
          <ul>
            <li>
              The application may have been deleted by another administrator
            </li>
            <li>
              The application ID in the URL might be incorrect or malformed
            </li>
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
            <Link href="/dashboard/applications" className={styles.actionCard}>
              <span className={styles.actionIcon}>📱</span>
              <span className={styles.actionLabel}>View All Applications</span>
              <span className={styles.actionDescription}>
                Browse the complete list of applications
              </span>
            </Link>

            <Link
              href="/dashboard/applications/add"
              className={styles.actionCard}
            >
              <span className={styles.actionIcon}>➕</span>
              <span className={styles.actionLabel}>Create New Application</span>
              <span className={styles.actionDescription}>
                Add a new application to your catalog
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
            If you believe this application should exist, please{' '}
            <a href="mailto:support@benew.com" className={styles.helpLink}>
              contact support
            </a>{' '}
            with the application ID from the URL.
          </p>
        </div>
      </div>
    </div>
  );
}

// ✅ Metadata for SEO and security
export const metadata = {
  title: '404 - Application Not Found | Dashboard',
  description: 'The requested application could not be found.',
  robots: 'noindex, nofollow',
};
