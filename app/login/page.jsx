// app/login/page.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn, useSession } from '@/lib/auth-client';
import '@/ui/styling/login/login.css';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  // ✅ Rediriger si déjà connecté
  if (session?.user) {
    router.push('/dashboard');
    return null;
  }

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
    setIsLoading(true);
    setErrors({});

    try {
      // Validation
      const newErrors = {};
      if (!formData.email) {
        newErrors.email = 'Email is required';
      }
      if (!formData.password) {
        newErrors.password = 'Password is required';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsLoading(false);
        return;
      }

      // ✅ Better Auth sign in sans callbackURL
      const { data, error } = await signIn.email(
        {
          email: formData.email,
          password: formData.password,
          // ❌ SUPPRIMER callbackURL - géré manuellement
        },
        {
          onRequest(context) {
            console.log('Login request sent');
          },
          onSuccess(context) {
            console.log('Login successful:', context);
          },
          onError(context) {
            console.error('Login failed:', context.error);
          },
        },
      );

      if (error) {
        console.error('Login error:', error);

        if (error.status === 401) {
          setErrors({ submit: 'Invalid email or password' });
        } else if (error.status === 429) {
          setErrors({ submit: 'Too many attempts. Please try again later.' });
        } else {
          setErrors({ submit: error.message || 'Login failed' });
        }
      } else if (data) {
        // ✅ SUCCESS - Attendre un peu pour que le cookie soit set
        console.log('Login data:', data);

        // Attendre 100ms pour que le cookie soit bien enregistré
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Redirection manuelle
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ submit: 'Login failed. Please try again later.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Login</h1>
      <form onSubmit={handleSubmit} className="form">
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
          {errors.password && <div className="error">{errors.password}</div>}
        </div>

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

        {errors.submit && (
          <div className="error submit-error">{errors.submit}</div>
        )}

        <button type="submit" className="submit-button" disabled={isLoading}>
          {isLoading ? 'Logging in...' : 'Login'}
        </button>

        <div className="form-footer">
          <Link href="/forgot-password">Forgot password?</Link>
          <span className="divider">|</span>
          <Link href="/register">Register</Link>
        </div>
      </form>
    </div>
  );
}
