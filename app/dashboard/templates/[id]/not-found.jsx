// app/dashboard/templates/[id]/not-found.jsx - TEMPLATE NOT FOUND PAGE
import Link from 'next/link';
import styles from '@/ui/styling/dashboard/templates/editNotFound.module.css';

/**
 * TEMPLATE NOT FOUND (404) PAGE - Server Component
 *
 * Production-ready 404 handler for template edit route (5 users/day):
 * - Triggered when template ID doesn't exist in database
 * - Triggered when template ID validation fails
 * - Server Component (no client JS overhead)
 * - Helpful navigation back to templates list
 * - Security: No template ID disclosure in error messages
 *
 * When is this triggered?
 * - /dashboard/templates/non-existent-uuid
 * - /dashboard/templates/invalid-id-format
 * - /dashboard/templates/deleted-template-id
 * - Template fetch returns null from database
 *
 * IMPORTANT: For admin with 5 users/day:
 * - Template 404s should be RARE (admins know their templates)
 * - If frequent → investigate UI bugs or database issues
 * - Monitor 404 rate (should be <1% of template requests)
 *
 * Difference from templates list not-found.jsx:
 * - This is for specific template ID not found
 * - List not-found is for invalid /templates/* routes
 * - Different messaging and context
 */
export default function TemplateNotFound() {
  return (
    <div className={styles.notFoundContainer}>
      <div className={styles.notFoundCard}>
        {/* 404 Icon */}
        <div className={styles.notFoundIcon}>🔍</div>

        {/* Title */}
        <h1 className={styles.notFoundTitle}>Template Not Found</h1>

        {/* Description */}
        <p className={styles.notFoundDescription}>
          The template you&apos;re looking for doesn&apos;t exist or may have
          been deleted. Please check the template ID or return to the templates
          list.
        </p>

        {/* Context Notice */}
        <div className={styles.contextNotice}>
          <p>
            <strong>💡 Common Reasons:</strong>
          </p>
          <ul>
            <li>The template may have been deleted by another administrator</li>
            <li>The template ID in the URL might be incorrect or malformed</li>
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
            <Link href="/dashboard/templates" className={styles.actionCard}>
              <span className={styles.actionIcon}>📋</span>
              <span className={styles.actionLabel}>View All Templates</span>
              <span className={styles.actionDescription}>
                Browse the complete list of templates
              </span>
            </Link>

            <Link href="/dashboard/templates/add" className={styles.actionCard}>
              <span className={styles.actionIcon}>➕</span>
              <span className={styles.actionLabel}>Create New Template</span>
              <span className={styles.actionDescription}>
                Add a new template to your collection
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
            If you believe this template should exist, please{' '}
            <a href="mailto:support@benew.com" className={styles.helpLink}>
              contact support
            </a>{' '}
            with the template ID from the URL.
          </p>
        </div>
      </div>
    </div>
  );
}

// ✅ Metadata for SEO and security
export const metadata = {
  title: '404 - Template Not Found | Dashboard',
  description: 'The requested template could not be found.',
  robots: 'noindex, nofollow',
};
