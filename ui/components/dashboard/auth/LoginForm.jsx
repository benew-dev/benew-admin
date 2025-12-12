// app/login/LoginForm.jsx - CLIENT COMPONENT
'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { signIn } from '@/lib/auth-client';
import { loginSchema } from '@/utils/schemas/authSchema';
import { sanitizeLoginInputs } from '@/utils/sanitizers/sanitizeLoginInputs';
import * as Sentry from '@sentry/nextjs';

/**
 * LOGIN FORM - Client Component
 *
 * Production-ready features (5 users max/day):
 * - Client-side validation (Yup) + Sanitization for fast feedback
 * - Better Auth integration (automatic server validation)
 * - Rate limiting via Better Auth (3 attempts/10s default)
 * - Sentry monitoring for all attempts (critical for low-traffic admin)
 * - Accessible form with proper error handling
 */
export default function LoginForm({ callbackUrl = '/dashboard' }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false,
  });
  const [errors, setErrors] = useState({});
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  const loading = isPending || isLoading;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    // Clear field error on change (better UX)
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
    setIsLoading(true);
    setErrors({});

    // ✅ Sentry breadcrumb for monitoring
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Login attempt started',
      level: 'info',
    });

    try {
      // 1️⃣ Sanitize inputs (XSS protection)
      const sanitized = sanitizeLoginInputs(formData);

      // 2️⃣ Client-side validation (Yup - fast feedback)
      await loginSchema.validate(sanitized, { abortEarly: false });

      // 3️⃣ Better Auth sign in (automatic server validation + rate limiting)
      const { data, error } = await signIn.email(
        {
          email: sanitized.email,
          password: sanitized.password,
        },
        {
          onRequest: (context) => {
            Sentry.addBreadcrumb({
              category: 'auth',
              message: 'Login request sent',
              data: { email: sanitized.email },
            });
          },
          onSuccess: (context) => {
            Sentry.addBreadcrumb({
              category: 'auth',
              message: 'Login successful',
              level: 'info',
            });
          },
          onError: (context) => {
            console.error('Login failed:', context.error);
          },
        },
      );

      // 4️⃣ Handle Better Auth errors
      if (error) {
        const errorMessages = {
          401: 'Invalid email or password. Please try again.',
          403: 'Your account has been locked. Please contact support.',
          429: 'Too many login attempts. Please wait 10 seconds and try again.',
          500: 'Server error. Please try again later.',
        };

        const message =
          errorMessages[error.status] || error.message || 'Login failed';

        setErrors({ submit: message });

        // ✅ Critical: Monitor rate limit violations (5 users/day = anomalies matter)
        if (error.status === 429) {
          Sentry.captureMessage('Rate limit exceeded on login', {
            level: 'warning',
            tags: { component: 'login', email: sanitized.email },
          });
        }

        setIsLoading(false);
        return;
      }

      // 5️⃣ Success - Wait for cookie, then redirect
      if (data) {
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'Login successful, redirecting',
          level: 'info',
        });

        // ✅ Delay to ensure cookie is set
        await new Promise((resolve) => setTimeout(resolve, 100));

        // ✅ Force full page reload for middleware session pickup
        startTransition(() => {
          window.location.href = callbackUrl;
        });
      }
    } catch (validationError) {
      // ✅ Handle Yup validation errors
      if (validationError.inner) {
        const newErrors = {};
        validationError.inner.forEach((err) => {
          newErrors[err.path] = err.message;
        });
        setErrors(newErrors);
      } else {
        // ✅ Unexpected errors
        console.error('Unexpected login error:', validationError);
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
    <form onSubmit={handleSubmit} className="form" noValidate>
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

      {/* Remember Me Checkbox */}
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
