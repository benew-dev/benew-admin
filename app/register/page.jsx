// app/register/page.jsx - SERVER COMPONENT
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import '@/ui/styling/register/register.css';
import RegistrationForm from '@/ui/components/dashboard/auth/RegistrationForm';
import { trackAuth } from '@/utils/monitoring';

/**
 * REGISTRATION PAGE - Server Component
 *
 * Production-ready features for admin app (5 users max/day):
 * - Server-side session check (prevent duplicate registrations)
 * - Automatic redirect if already authenticated
 * - Zero client-side JavaScript for auth check
 * - Security warnings for admin-only access
 *
 * IMPORTANT: For production with 5 users max, consider:
 * 1. Disabling public registration entirely (create users via DB/CLI)
 * 2. Implementing invitation-only registration (token required)
 * 3. Adding email domain whitelist (@yourcompany.com only)
 */
export default async function RegisterPage({ searchParams }) {
  // ✅ Server-side session verification
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // ✅ Redirect authenticated users
  if (session?.user) {
    trackAuth('register_page_already_authenticated', {
      userId: session.user.id,
      redirectTo: '/dashboard',
    });
    redirect('/dashboard');
  }

  // ✅ Extract URL params
  const invitationToken = searchParams?.token; // For invitation-only flow (optional)
  const errorParam = searchParams?.error;

  // ✅ OPTIONAL: Uncomment to require invitation token
  if (!invitationToken) {
    trackAuth('register_page_no_invitation_token', {}, 'warning');

    return (
      <div className="container">
        <h1>Admin Registration</h1>
        <p
          style={{
            textAlign: 'center',
            color: 'var(--textSoft)',
            marginTop: '1rem',
          }}
        >
          Registration is by invitation only. Please contact your administrator.
        </p>
      </div>
    );
  }

  // Track registration page visit
  trackAuth('register_page_visited', {
    hasInvitationToken: !!invitationToken,
    hasError: !!errorParam,
  });

  return (
    <div className="container">
      <h1>User Registration</h1>

      {/* ✅ Admin warning banner */}
      <div
        style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          backgroundColor: '#fef3c7',
          color: '#92400e',
          borderRadius: '4px',
          fontSize: '0.875rem',
          border: '1px solid #fcd34d',
        }}
      >
        <strong>⚠️ Admin Access Only</strong>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.813rem' }}>
          This registration is for authorized administrators only. All
          registrations are logged and monitored.
        </p>
      </div>

      {/* ✅ Error message from URL params */}
      {errorParam && (
        <div className="error submit-error">
          {decodeURIComponent(errorParam)}
        </div>
      )}

      {/* ✅ Client Component for form interactivity */}
      <RegistrationForm invitationToken={invitationToken} />
    </div>
  );
}

// ✅ Metadata for security
export const metadata = {
  title: 'Admin Registration | Benew',
  robots: 'noindex, nofollow', // Prevent search engine indexing
};
