// app/loading.jsx - GLOBAL LOADING STATE
import '@/ui/styling/loading.css';

/**
 * GLOBAL LOADING COMPONENT - Server Component
 *
 * Production-ready loading state for admin app (5 users/day):
 * - Displayed automatically by Next.js during route transitions
 * - Consistent UX across all pages (dashboard, auth, etc.)
 * - Lightweight spinner with accessibility support
 * - No JavaScript required (pure CSS animation)
 * - Matches app theme colors (var(--bg), var(--text))
 *
 * When is this shown?
 * - Navigation between routes (client-side)
 * - Initial page load with Suspense boundaries
 * - Data fetching in Server Components
 *
 * Note: For admin with 5 users/day and fast DB queries,
 * this loading state will be very brief (100-300ms typically)
 */
export default function Loading() {
  return (
    <div className="loading-container" role="status" aria-live="polite">
      {/* Spinner */}
      <div className="spinner-wrapper">
        <div className="spinner" aria-hidden="true"></div>
      </div>

      {/* Loading text */}
      <p className="loading-text">Loading...</p>

      {/* Screen reader only text */}
      <span className="sr-only">Loading content, please wait</span>
    </div>
  );
}
