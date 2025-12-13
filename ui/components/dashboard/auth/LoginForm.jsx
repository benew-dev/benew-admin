// ui/components/dashboard/auth/LoginForm.jsx - FINAL FIX
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/auth-client';
import { loginSchema } from '@/utils/schemas/authSchema';
import { sanitizeLoginInputs } from '@/utils/sanitizers/sanitizeLoginInputs';
import * as Sentry from '@sentry/nextjs';

/**
 * 🔴 CRITICAL FIX - COOKIE RACE CONDITION
 *
 * PROBLÈME: window.location.href cause cookie race condition
 * - Cookie set par Better Auth dans response
 * - Browser navigate AVANT que cookie soit traité
 * - Middleware check cookie → PAS ENCORE LÀ → redirect login
 * - BOUCLE INFINIE !
 *
 * SOLUTION: Server-side redirect avec router.refresh()
 * - Attend que cookie soit traité par browser
 * - Force server component re-render
 * - Middleware voit le cookie correctement
 */
export default function LoginForm({ callbackUrl = '/dashboard' }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const loading = isPending || isLoading;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    setIsLoading(true);
    setErrors({});

    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Login attempt started',
      level: 'info',
    });

    try {
      // 1️⃣ Sanitize
      const sanitized = sanitizeLoginInputs(formData);

      // 2️⃣ Validation Yup
      await loginSchema.validate(sanitized, { abortEarly: false });

      // 3️⃣ Better Auth sign in
      const { data, error } = await signIn.email(
        {
          email: sanitized.email,
          password: sanitized.password,
        },
        {
          onRequest: () => {
            Sentry.addBreadcrumb({
              category: 'auth',
              message: 'Better Auth request sent',
            });
          },
          onSuccess: () => {
            Sentry.addBreadcrumb({
              category: 'auth',
              message: 'Better Auth success',
              level: 'info',
            });
          },
          onError: (context) => {
            Sentry.captureException(context.error, {
              tags: { component: 'login', phase: 'better-auth' },
            });
          },
        },
      );

      // 4️⃣ Handle errors
      if (error) {
        const errorMessages = {
          400: 'Invalid request. Please check your credentials.',
          401: 'Invalid email or password.',
          403: 'Account locked. Contact support.',
          429: 'Too many attempts. Wait 10 seconds.',
          500: 'Server error. Try again later.',
        };

        const message =
          errorMessages[error.status] ||
          error.message ||
          'Login failed. Try again.';

        setErrors({ submit: message });

        if (error.status === 429) {
          Sentry.captureMessage('Rate limit exceeded on login', {
            level: 'warning',
            tags: { component: 'login' },
          });
        }

        console.error('[LoginForm] Better Auth error:', {
          status: error.status,
          message,
        });

        setIsLoading(false);
        return;
      }

      // 5️⃣ Success - Server-side redirect avec transition
      if (data) {
        console.log('[LoginForm] Login successful, redirecting...');

        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'Login successful, redirecting',
          level: 'info',
        });

        // 🔥 FIX CRITIQUE: Utiliser startTransition + router.refresh
        // Permet au browser de traiter le cookie AVANT navigation
        startTransition(() => {
          // Force re-fetch des Server Components (middleware voit cookie)
          router.refresh();

          // Navigate vers destination
          router.push(callbackUrl);
        });

        // Alternative si transition échoue (très rare)
        setTimeout(() => {
          if (window.location.pathname === '/login') {
            console.warn('[LoginForm] Transition failed, using hard reload');
            window.location.href = callbackUrl;
          }
        }, 3000);
      }
    } catch (validationError) {
      if (validationError.inner) {
        const newErrors = {};
        validationError.inner.forEach((err) => {
          newErrors[err.path] = err.message;
        });
        setErrors(newErrors);
        console.log('[LoginForm] Validation errors:', newErrors);
      } else {
        console.error('[LoginForm] Unexpected error:', validationError);
        Sentry.captureException(validationError, {
          tags: { component: 'login', phase: 'validation' },
        });
        setErrors({
          submit: 'An unexpected error occurred. Please try again.',
        });
      }
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      method="POST"
      action="#"
      className="form"
      noValidate
    >
      {/* Email Field */}
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          onChange={handleChange}
          value={formData.email}
          disabled={loading}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          placeholder="admin@benew.com"
        />
        {errors.email && (
          <div id="email-error" className="error" role="alert">
            {errors.email}
          </div>
        )}
      </div>

      {/* Password Field */}
      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          onChange={handleChange}
          value={formData.password}
          disabled={loading}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
        />
        {errors.password && (
          <div id="password-error" className="error" role="alert">
            {errors.password}
          </div>
        )}
      </div>

      {/* Remember Me */}
      <div className="form-group checkbox">
        <label>
          <input
            type="checkbox"
            name="remember"
            checked={formData.remember}
            onChange={handleChange}
            disabled={loading}
          />
          Remember me
        </label>
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="error submit-error" role="alert">
          {errors.submit}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        className="submit-button"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>

      {/* Footer Links */}
      <div className="form-footer">
        <Link href="/forgot-password">Forgot password?</Link>
        <span className="divider">|</span>
        <Link href="/register">Register</Link>
      </div>
    </form>
  );
}
