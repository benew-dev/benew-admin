// ui/pages/platforms/AddPlatform.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MdArrowBack } from 'react-icons/md';
import styles from '@/ui/styling/dashboard/platforms/add/addPlatform.module.css';
import { platformAddingSchema } from '@/utils/schemas/platformSchema';
import {
  trackForm,
  trackValidation,
  trackDatabaseError,
} from '@/utils/monitoring';

export default function AddPlatform() {
  const router = useRouter();

  const [platformName, setPlatformName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    trackForm('add_platform_submit_started', {});

    const formData = {
      platformName,
      accountName,
      accountNumber,
    };

    try {
      // Validation Yup
      await platformAddingSchema.validate(formData, { abortEarly: false });

      const response = await fetch('/api/dashboard/platforms/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.platform) {
        trackForm('add_platform_successful', {
          platformId: data.platform.id,
        });

        router.push('/dashboard/platforms?added=true');
      } else {
        setErrorMessage(data.message || 'Failed to add platform');
        trackValidation('add_platform_failed', {}, 'warning');
      }
    } catch (validationError) {
      if (validationError.name === 'ValidationError') {
        const firstError = validationError.errors[0];
        setErrorMessage(firstError || 'Validation failed');

        trackValidation(
          'add_platform_validation_failed',
          {
            errors: validationError.errors,
          },
          'warning',
        );
      } else if (validationError.message?.includes('HTTP error')) {
        setErrorMessage('Server error occurred. Please try again.');
        trackDatabaseError(validationError, 'add_platform_http');
      } else {
        setErrorMessage(
          validationError.message ||
            'An error occurred while adding the platform',
        );
        trackDatabaseError(validationError, 'add_platform');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.addPlatformContainer}>
      <Link href="/dashboard/platforms" className={styles.backButton}>
        <MdArrowBack /> Back to Platforms
      </Link>

      <h1>Add Payment Platform</h1>

      <form className={styles.addPlatformForm} onSubmit={handleSubmit}>
        {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}

        <div className={styles.inputs}>
          <input
            type="text"
            name="platformName"
            placeholder="Platform Name (e.g., Orange Money, Wave)"
            value={platformName}
            onChange={(e) => setPlatformName(e.target.value)}
            maxLength="50"
            required
            disabled={isSubmitting}
          />

          <input
            type="text"
            name="accountName"
            placeholder="Account Name (e.g., BENEW SARL)"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            maxLength="50"
            required
            disabled={isSubmitting}
          />

          <input
            type="text"
            name="accountNumber"
            placeholder="Account Number (e.g., 77123456)"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            maxLength="20"
            required
            disabled={isSubmitting}
          />
        </div>

        <button
          type="submit"
          className={styles.addButton}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Adding Platform...' : 'Add Platform'}
        </button>
      </form>
    </div>
  );
}
