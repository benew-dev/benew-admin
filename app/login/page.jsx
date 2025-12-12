// app/login/page.jsx - SERVER COMPONENT
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import '@/ui/styling/login/login.css';
import LoginForm from '@/ui/components/dashboard/auth/LoginForm';

/**
 * LOGIN PAGE - Server Component
 *
 * Production-ready features (5 users max/day):
 * - Server-side session check (no client overhead)
 * - Automatic redirect if already authenticated
 * - Supports callback URLs and error messages via URL params
 * - Zero unnecessary JavaScript for auth verification
 */
export default async function LoginPage({ searchParams }) {
  // ✅ Server-side session verification (optimized for 5 users/day)
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // ✅ Redirect authenticated users immediately
  if (session?.user) {
    redirect('/dashboard');
  }

  // ✅ Extract URL params for better UX
  const callbackUrl = searchParams?.callbackUrl || '/dashboard';
  const registered = searchParams?.registered === 'true';
  const errorParam = searchParams?.error;

  return (
    <div className="container">
      <h1>Login</h1>

      {/* ✅ Success message after registration */}
      {registered && (
        <div
          className="success-banner"
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#d1fae5',
            color: '#065f46',
            borderRadius: '4px',
            textAlign: 'center',
          }}
        >
          ✓ Registration successful! Please log in to continue.
        </div>
      )}

      {/* ✅ Error message from URL params */}
      {errorParam && (
        <div className="error submit-error">
          {decodeURIComponent(errorParam)}
        </div>
      )}

      {/* ✅ Client Component for form interactivity */}
      <LoginForm callbackUrl={callbackUrl} />
    </div>
  );
}

// ✅ Metadata for security
export const metadata = {
  title: 'Admin Login | Benew',
  robots: 'noindex, nofollow', // Prevent search engine indexing
};
