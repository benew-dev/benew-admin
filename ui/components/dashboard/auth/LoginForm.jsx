// ui/components/dashboard/auth/LoginForm.jsx - SOLUTION AU PROBLÈME DE REDIRECTION
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from '@/lib/auth-client';
import { loginSchema } from '@/utils/schemas/authSchema';
import { sanitizeLoginInputs } from '@/utils/sanitizers/sanitizeLoginInputs';
import { trackAuth, trackAuthError } from '@/utils/monitoring';

/**
 * 🔥 SOLUTION AU PROBLÈME DE REDIRECTION
 *
 * PROBLÈME IDENTIFIÉ:
 * - router.push() utilise le cache côté client de Next.js
 * - Le cache contient la version non-authentifiée de /dashboard
 * - Même si le cookie est défini, Next.js charge depuis le cache
 * - Résultat: URL change mais page reste bloquée sur /login
 *
 * SOLUTION:
 * - Utiliser window.location.href au lieu de router.push
 * - Force un hard reload (bypass du cache Next.js)
 * - Le middleware s'exécute à nouveau et voit le nouveau cookie
 * - Redirection réussie vers /dashboard
 *
 * SOURCES:
 * - https://github.com/vercel/next.js/discussions/51782
 * - https://www.wisp.blog/blog/best-practices-for-redirecting-users-post-authentication-in-nextjs
 * - https://github.com/vercel/next.js/discussions/58940
 */
export default function LoginForm({ callbackUrl = '/dashboard' }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

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

    trackAuth('login_attempt_started');

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
            trackAuth('better_auth_request_sent');
          },
          onSuccess: () => {
            trackAuth('better_auth_success');
          },
          onError: (context) => {
            trackAuthError(context.error, 'better_auth_call');
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
          trackAuth('rate_limit_exceeded', {}, 'warning');
        }

        console.error('[LoginForm] Better Auth error:', {
          status: error.status,
          message,
        });

        setIsLoading(false);
        return;
      }

      // 5️⃣ Success - HARD REDIRECT pour éviter problème de cache
      if (data) {
        console.log(
          '[LoginForm] Login successful, redirecting with hard reload...',
        );

        trackAuth('login_successful_hard_redirecting');

        // 🔥 SOLUTION: Hard redirect au lieu de router.push
        // Cela force Next.js à bypass le cache et recharger complètement
        // Le middleware s'exécutera à nouveau et verra le nouveau cookie
        window.location.href = callbackUrl;

        // Note: On ne set pas isLoading à false car la page va recharger
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
        trackAuthError(validationError, 'validation');
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
          disabled={isLoading}
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
          disabled={isLoading}
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
            disabled={isLoading}
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
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? 'Logging in...' : 'Login'}
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
