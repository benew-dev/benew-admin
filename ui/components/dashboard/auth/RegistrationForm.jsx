// app/register/RegistrationForm.jsx - CLIENT COMPONENT
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signUp } from '@/lib/auth-client';
import { registrationSchema } from '@/utils/schemas/authSchema';
import { sanitizeRegistrationInputsStrict } from '@/utils/sanitizers/sanitizeRegistrationInputs';
import * as Sentry from '@sentry/nextjs';

/**
 * REGISTRATION FORM - Client Component
 *
 * Production-ready features for admin app (5 users max/day):
 * - Strict validation (Yup) + Aggressive sanitization (XSS protection)
 * - Better Auth integration (automatic server validation)
 * - Password strength indicator with admin-level requirements
 * - Rate limiting via Better Auth (default for /sign-up/email)
 * - Sentry tracking for all registration attempts
 * - Optional email domain whitelist for company emails only
 */
export default function RegistrationForm({ invitationToken }) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    terms: false,
  });
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  const loading = isPending || isLoading;

  /**
   * Calculate password strength (0-100)
   * Admin requirements: 8+ chars, uppercase, lowercase, number, special char
   */
  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 10; // Bonus
    if (/[A-Z]/.test(password)) strength += 20;
    if (/[a-z]/.test(password)) strength += 20;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[^A-Za-z0-9]/.test(password)) strength += 15;
    return strength;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    // Update password strength
    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }

    // Clear field error on change
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

    // ✅ Sentry breadcrumb
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Registration attempt started',
      level: 'info',
    });

    try {
      // 1️⃣ Strict sanitization (zero tolerance for malicious input)
      const sanitized = sanitizeRegistrationInputsStrict(formData);

      // 2️⃣ Client-side validation (Yup)
      await registrationSchema.validate(sanitized, { abortEarly: false });

      // 3️⃣ OPTIONAL: Email domain whitelist for admin accounts
      const emailDomain = sanitized.email.split('@')[1];
      const allowedDomains = ['benew.com', 'admin.benew.com'];

      // ✅ Uncomment to enforce company email only:
      if (!allowedDomains.includes(emailDomain)) {
        setErrors({
          email: 'Please use your company email address (@benew-dj.com)',
        });
        setIsLoading(false);
        return;
      }

      // 4️⃣ Better Auth sign up (automatic server validation + rate limiting)
      const { data, error } = await signUp.email(
        {
          name: sanitized.username,
          email: sanitized.email,
          password: sanitized.password,
          phone: sanitized.phone,
          birthdate: sanitized.dateOfBirth,
        },
        {
          onRequest: (context) => {
            Sentry.addBreadcrumb({
              category: 'auth',
              message: 'Registration request sent',
              data: { email: sanitized.email },
            });
          },
          onSuccess: (context) => {
            Sentry.addBreadcrumb({
              category: 'auth',
              message: 'Registration successful',
              level: 'info',
            });
          },
          onError: (context) => {
            console.error('Registration failed:', context.error);
          },
        },
      );

      // 5️⃣ Handle Better Auth errors
      if (error) {
        const errorMessages = {
          400: 'Invalid registration data. Please check your inputs.',
          409: 'An account with this email already exists.',
          429: 'Too many registration attempts. Please wait a few minutes.',
          500: 'Server error. Please try again later.',
        };

        const message =
          errorMessages[error.status] || error.message || 'Registration failed';

        // Special handling for duplicate email
        if (error.status === 409) {
          setErrors({ email: message });
        } else {
          setErrors({ submit: message });
        }

        // ✅ Monitor critical events (5 users = every anomaly matters)
        if (error.status === 429) {
          Sentry.captureMessage('Rate limit exceeded on registration', {
            level: 'warning',
            tags: { component: 'register', email: sanitized.email },
          });
        } else if (error.status === 409) {
          Sentry.captureMessage('Duplicate registration attempt', {
            level: 'info',
            tags: { component: 'register', email: sanitized.email },
          });
        }

        setIsLoading(false);
        return;
      }

      // 6️⃣ Success - Redirect to login with success message
      if (data) {
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'Registration successful, redirecting',
          level: 'info',
        });

        startTransition(() => {
          router.push('/login?registered=true');
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
        console.error('Unexpected registration error:', validationError);
        Sentry.captureException(validationError, {
          tags: { component: 'register', phase: 'validation' },
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
      {/* Username */}
      <div className="form-group">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="name"
          onChange={handleChange}
          value={formData.username}
          disabled={loading}
          aria-invalid={!!errors.username}
          aria-describedby={errors.username ? 'username-error' : undefined}
        />
        {errors.username && (
          <div id="username-error" className="error" role="alert">
            {errors.username}
          </div>
        )}
      </div>

      {/* Email */}
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

      {/* Phone */}
      <div className="form-group">
        <label htmlFor="phone">Phone</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          onChange={handleChange}
          value={formData.phone}
          disabled={loading}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? 'phone-error' : undefined}
        />
        {errors.phone && (
          <div id="phone-error" className="error" role="alert">
            {errors.phone}
          </div>
        )}
      </div>

      {/* Password with Strength Indicator */}
      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          onChange={handleChange}
          value={formData.password}
          disabled={loading}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
        />
        {formData.password && (
          <div className="password-strength">
            <div
              className="strength-bar"
              style={{
                width: `${passwordStrength}%`,
                backgroundColor: `hsl(${passwordStrength}, 70%, 45%)`,
              }}
            />
          </div>
        )}
        {errors.password && (
          <div id="password-error" className="error" role="alert">
            {errors.password}
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <div className="form-group">
        <label htmlFor="confirmPassword">Confirm Password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          onChange={handleChange}
          value={formData.confirmPassword}
          disabled={loading}
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={
            errors.confirmPassword ? 'confirm-error' : undefined
          }
        />
        {errors.confirmPassword && (
          <div id="confirm-error" className="error" role="alert">
            {errors.confirmPassword}
          </div>
        )}
      </div>

      {/* Date of Birth */}
      <div className="form-group">
        <label htmlFor="dateOfBirth">Date of Birth</label>
        <input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          autoComplete="bday"
          onChange={handleChange}
          value={formData.dateOfBirth}
          disabled={loading}
          max={new Date().toISOString().split('T')[0]}
          aria-invalid={!!errors.dateOfBirth}
          aria-describedby={errors.dateOfBirth ? 'dob-error' : undefined}
        />
        {errors.dateOfBirth && (
          <div id="dob-error" className="error" role="alert">
            {errors.dateOfBirth}
          </div>
        )}
      </div>

      {/* Terms Checkbox */}
      <div className="form-group checkbox">
        <label>
          <input
            type="checkbox"
            name="terms"
            checked={formData.terms}
            onChange={handleChange}
            disabled={loading}
            aria-invalid={!!errors.terms}
            aria-describedby={errors.terms ? 'terms-error' : undefined}
          />
          I accept the terms and conditions
        </label>
        {errors.terms && (
          <div id="terms-error" className="error" role="alert">
            {errors.terms}
          </div>
        )}
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
        {loading ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
}
