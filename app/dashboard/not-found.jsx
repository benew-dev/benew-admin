// app/dashboard/not-found.jsx - DASHBOARD 404 PAGE
import Link from 'next/link';
import styles from '@/ui/styling/dashboard/not-found.module.css';

/**
 * DASHBOARD NOT FOUND (404) PAGE - Server Component
 *
 * Production-ready 404 handler for dashboard routes (5 users/day):
 * - Triggered when user navigates to non-existent dashboard route
 * - Server Component (no client JS overhead)
 * - Dashboard-specific navigation (different from global 404)
 * - Helpful navigation to valid dashboard sections
 * - Security: No route enumeration (prevents discovery attacks)
 *
 * When is this triggered?
 * - /dashboard/invalid-route
 * - /dashboard/templates/999999 (non-existent ID)
 * - /dashboard/users/deleted-user
 * - Typos in dashboard URLs
 *
 * IMPORTANT: For admin with 5 users/day:
 * - 404s should be VERY RARE (users know the routes)
 * - If 404s are frequent → investigate UI/navigation bugs
 * - Monitor 404 rate (should be <0.5% of requests)
 *
 * Difference from global not-found.jsx:
 * - This catches /dashboard/* routes only
 * - Global not-found.jsx catches all other routes
 * - Different styling (matches dashboard theme)
 */
export default function DashboardNotFound() {
  return (
    <div className={styles.notFoundContainer}>
      <div className={styles.notFoundCard}>
        {/* 404 Icon/Number */}
        <div className={styles.notFoundIcon}>404</div>

        {/* Title */}
        <h1 className={styles.notFoundTitle}>Dashboard Page Not Found</h1>

        {/* Description */}
        <p className={styles.notFoundDescription}>
          The dashboard page you&apos;re looking for doesn&apos;t exist or has
          been moved. Please check the URL or use the navigation menu.
        </p>

        {/* Admin Context Notice */}
        <div className={styles.contextNotice}>
          <p>
            <strong>💡 Common Reasons:</strong>
          </p>
          <ul>
            <li>The item you&apos;re trying to view may have been deleted</li>
            <li>The URL might contain a typo</li>
            <li>This feature may not be available yet</li>
            <li>You may need different permissions to access this page</li>
          </ul>
        </div>

        {/* Quick Navigation - Dashboard Specific */}
        <div className={styles.quickNav}>
          <h2 className={styles.quickNavTitle}>Quick Navigation</h2>
          <div className={styles.navGrid}>
            <Link href="/dashboard" className={styles.navCard}>
              <span className={styles.navIcon}>🏠</span>
              <span className={styles.navLabel}>Dashboard Home</span>
            </Link>

            <Link href="/dashboard/templates" className={styles.navCard}>
              <span className={styles.navIcon}>📄</span>
              <span className={styles.navLabel}>Templates</span>
            </Link>

            <Link href="/dashboard/applications" className={styles.navCard}>
              <span className={styles.navIcon}>📱</span>
              <span className={styles.navLabel}>Applications</span>
            </Link>

            <Link href="/dashboard/platforms" className={styles.navCard}>
              <span className={styles.navIcon}>🖥️</span>
              <span className={styles.navLabel}>Platforms</span>
            </Link>

            <Link href="/dashboard/blog" className={styles.navCard}>
              <span className={styles.navIcon}>✍️</span>
              <span className={styles.navLabel}>Blog</span>
            </Link>

            <Link href="/dashboard/users" className={styles.navCard}>
              <span className={styles.navIcon}>👥</span>
              <span className={styles.navLabel}>Users</span>
            </Link>
          </div>
        </div>

        {/* Support Footer */}
        <div className={styles.supportFooter}>
          <p className={styles.supportText}>
            Can&apos;t find what you&apos;re looking for?{' '}
            <a href="mailto:support@benew.com" className={styles.supportLink}>
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
  title: '404 - Page Not Found | Dashboard',
  description: 'The requested dashboard page could not be found.',
  robots: 'noindex, nofollow', // Never index 404 pages
};
