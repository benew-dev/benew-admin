'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signUp } from '@/lib/auth-client';
import { registrationSchema } from '@/utils/schemas/authSchema';
import '@/ui/styling/register/register.css';

export default function RegistrationPage() {
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
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return (strength / 5) * 100;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }

    // Clear error when field is modified
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

    try {
      // Validation Yup (conservée)
      await registrationSchema.validate(formData, { abortEarly: false });

      // Better Auth sign up
      const { data, error } = await signUp.email({
        name: formData.username,
        email: formData.email,
        password: formData.password,
        phone: formData.phone, // ← Champs additionnels
        birthdate: formData.dateOfBirth,
        // Champs additionnels (phone, birthdate)
        // Seront passés via callbackURL ou session custom
        callbackURL: '/login',
        // Fetch options pour vos custom sanitizers/rate limiters
        fetchOptions: {
          onRequest(context) {
            // Vous pouvez ajouter vos headers custom ici
            // context.request.headers.set('X-Rate-Limit', 'user');
          },
          onSuccess(context) {
            console.log('Registration successful');
          },
          onError(context) {
            console.error('Registration failed:', context.error);
          },
        },
      });

      if (error) {
        // Better Auth error handling
        if (error.status === 400) {
          setErrors({ submit: error.message || 'Invalid registration data' });
        } else if (error.status === 409) {
          setErrors({ email: 'A user with this email already exists' });
        } else if (error.status === 429) {
          setErrors({
            submit: 'Too many registration attempts. Please try again later.',
          });
        } else {
          setErrors({ submit: error.message || 'Registration failed' });
        }
      } else {
        // Success - redirect to login
        router.push('/login?registered=true');
      }
    } catch (validationErrors) {
      // Yup validation errors
      const newErrors = {};
      validationErrors.inner?.forEach((error) => {
        newErrors[error.path] = error.message;
      });
      setErrors(newErrors);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>User Registration</h1>
      <form onSubmit={handleSubmit} className="form">
        {/* Username */}
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            onChange={handleChange}
            value={formData.username}
            disabled={isLoading}
          />
          {errors.username && <div className="error">{errors.username}</div>}
        </div>

        {/* Email */}
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            onChange={handleChange}
            value={formData.email}
            disabled={isLoading}
          />
          {errors.email && <div className="error">{errors.email}</div>}
        </div>

        {/* Phone */}
        <div className="form-group">
          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            onChange={handleChange}
            value={formData.phone}
            disabled={isLoading}
          />
          {errors.phone && <div className="error">{errors.phone}</div>}
        </div>

        {/* Password */}
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            onChange={handleChange}
            value={formData.password}
            disabled={isLoading}
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
          {errors.password && <div className="error">{errors.password}</div>}
        </div>

        {/* Confirm Password */}
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            onChange={handleChange}
            value={formData.confirmPassword}
            disabled={isLoading}
          />
          {errors.confirmPassword && (
            <div className="error">{errors.confirmPassword}</div>
          )}
        </div>

        {/* Date of Birth */}
        <div className="form-group">
          <label htmlFor="dateOfBirth">Date of Birth</label>
          <input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            onChange={handleChange}
            value={formData.dateOfBirth}
            disabled={isLoading}
          />
          {errors.dateOfBirth && (
            <div className="error">{errors.dateOfBirth}</div>
          )}
        </div>

        {/* Terms */}
        <div className="form-group checkbox">
          <label>
            <input
              type="checkbox"
              name="terms"
              checked={formData.terms}
              onChange={handleChange}
              disabled={isLoading}
            />
            I accept the terms and conditions
          </label>
          {errors.terms && <div className="error">{errors.terms}</div>}
        </div>

        {errors.submit && (
          <div className="error submit-error">{errors.submit}</div>
        )}

        <button type="submit" className="submit-button" disabled={isLoading}>
          {isLoading ? 'Registering...' : 'Register'}
        </button>
      </form>
    </div>
  );
}
