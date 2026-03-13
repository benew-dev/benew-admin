// app/dashboard/channel/[id]/edit/not-found.jsx
import Link from 'next/link';
import styles from '@/ui/styling/dashboard/channel/edit/editNotFound.module.css';

export default function EditVideoNotFound() {
  return (
    <div className={styles.notFoundContainer}>
      <div className={styles.notFoundCard}>
        <div className={styles.notFoundIcon}>🔍</div>

        <h1 className={styles.notFoundTitle}>Video Not Found</h1>

        <p className={styles.notFoundDescription}>
          The video you&apos;re trying to edit doesn&apos;t exist or may have
          been deleted. Please check the video ID or return to the videos list.
        </p>

        <div className={styles.contextNotice}>
          <p>
            <strong>💡 Common Reasons:</strong>
          </p>
          <ul>
            <li>The video may have been deleted by another administrator</li>
            <li>The video ID in the URL might be incorrect or malformed</li>
            <li>You may have followed an outdated link or bookmark</li>
            <li>There could be a temporary database connectivity issue</li>
          </ul>
        </div>

        <div className={styles.quickActions}>
          <h2 className={styles.quickActionsTitle}>
            What would you like to do?
          </h2>
          <div className={styles.actionsGrid}>
            <Link href="/dashboard/channel" className={styles.actionCard}>
              <span className={styles.actionIcon}>🎬</span>
              <span className={styles.actionLabel}>View All Videos</span>
              <span className={styles.actionDescription}>
                Browse the complete list of videos
              </span>
            </Link>

            <Link href="/dashboard/channel/add" className={styles.actionCard}>
              <span className={styles.actionIcon}>➕</span>
              <span className={styles.actionLabel}>Add New Video</span>
              <span className={styles.actionDescription}>
                Upload a new video to your channel
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

        <div className={styles.helpFooter}>
          <p className={styles.helpText}>
            If you believe this video should exist, please{' '}
            <a href="mailto:support@benew.com" className={styles.helpLink}>
              contact support
            </a>{' '}
            with the video ID from the URL.
          </p>
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: '404 - Video Not Found | Dashboard',
  description: 'The requested video could not be found.',
  robots: 'noindex, nofollow',
};
