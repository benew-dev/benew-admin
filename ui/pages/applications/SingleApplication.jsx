// ui/pages/applications/SingleApplication.jsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MdArrowBack, MdCheck, MdClose } from 'react-icons/md';
import styles from '@/ui/styling/dashboard/applications/singleApplication.module.css';
import {
  trackUI,
  trackNavigation,
  trackDatabaseError,
} from '@/utils/monitoring';

export default function SingleApplication({ data }) {
  const router = useRouter();
  const [application, setApplication] = useState(data);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setApplication(data);
    trackUI('single_application_mounted', {
      applicationId: data?.application_id,
      applicationName: data?.application_name,
    });
  }, [data]);

  if (!application) {
    return (
      <div className={styles.notFound}>
        <p>Application not found</p>
        <Link href="/dashboard/applications" className={styles.backButton}>
          <MdArrowBack /> Back to Applications
        </Link>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this application?')) {
      trackUI('delete_cancelled', {
        applicationId: application.application_id,
      });
      return;
    }

    setIsDeleting(true);
    trackUI('delete_started', { applicationId: application.application_id });

    try {
      const response = await fetch(
        `/api/dashboard/applications/${application.application_id}/delete`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: application.application_id,
            application_images: application.application_images,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        trackUI('delete_successful', {
          applicationId: application.application_id,
        });
        router.push('/dashboard/applications?deleted=true');
      } else {
        throw new Error(data.message || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(error.message || 'Failed to delete application. Please try again.');
      trackDatabaseError(error, 'delete_application_client', {
        applicationId: application.application_id,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.singleApplicationContainer}>
      <Link
        href="/dashboard/applications"
        className={styles.backButton}
        onClick={() => trackNavigation('back_to_applications_list')}
      >
        <MdArrowBack /> Back to Applications
      </Link>

      <h1>{application.application_name}</h1>

      {/* Status indicator */}
      <div
        className={`${styles.statusIndicator} ${application.is_active ? styles.active : styles.inactive}`}
      >
        {application.is_active ? (
          <>
            <MdCheck className={styles.statusIcon} />
            <span>Active Application</span>
          </>
        ) : (
          <>
            <MdClose className={styles.statusIcon} />
            <span>Inactive Application</span>
          </>
        )}
      </div>

      <div className={styles.applicationDetails}>
        {/* Images */}
        <div className={styles.applicationImages}>
          {Array.isArray(application.application_images) &&
            application.application_images.map((image, index) => (
              <div key={index} className={styles.imageContainer}>
                <Image
                  src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_400,h_300/${image}`}
                  alt={`${application.application_name} image ${index + 1}`}
                  width={400}
                  height={300}
                  className={styles.image}
                />
              </div>
            ))}
        </div>

        {/* Info */}
        <div className={styles.applicationInfo}>
          <p className={styles.applicationType}>
            <strong>Level:</strong> {application.application_level}
          </p>

          <p>
            <strong>Public Link:</strong>{' '}
            <a
              href={application.application_link}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              {application.application_link}
            </a>
          </p>

          {application.application_admin_link && (
            <p>
              <strong>Admin Link:</strong>{' '}
              <a
                href={application.application_admin_link}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.link} ${styles.adminLink}`}
              >
                {application.application_admin_link}
              </a>
            </p>
          )}

          {application.application_description && (
            <p>
              <strong>Description:</strong>{' '}
              {application.application_description}
            </p>
          )}

          <p>
            <strong>Category:</strong> {application.application_category}
          </p>

          <p>
            <strong>Fee:</strong> {application.application_fee} Fdj
          </p>

          <p>
            <strong>Rent:</strong> {application.application_rent} Fdj/month
          </p>

          {/* Stats */}
          <div className={styles.statsContainer}>
            <div className={styles.statItem}>
              <strong>Sales Count:</strong>
              <span className={styles.salesCount}>
                {application.sales_count || 0} sales
              </span>
            </div>

            <div className={styles.statItem}>
              <strong>Status:</strong>
              <span
                className={`${styles.statusBadge} ${application.is_active ? styles.activeBadge : styles.inactiveBadge}`}
              >
                {application.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Dates */}
          <div className={styles.dateContainer}>
            <p>
              <strong>Created:</strong>
              <span className={styles.dateValue}>
                {formatDate(application.created_at)}
              </span>
            </p>

            <p>
              <strong>Last Updated:</strong>
              <span className={styles.dateValue}>
                {formatDate(application.updated_at)}
              </span>
            </p>
          </div>

          {/* Other versions */}
          {application.application_other_versions &&
            Array.isArray(application.application_other_versions) &&
            application.application_other_versions.length > 0 && (
              <div className={styles.versionsContainer}>
                <p>
                  <strong>Other Versions:</strong>
                </p>
                <div className={styles.versionsList}>
                  {application.application_other_versions.map(
                    (imageId, index) => (
                      <div key={index} className={styles.versionItem}>
                        <Image
                          src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_150,h_100/${imageId}`}
                          alt={`Version ${index + 1}`}
                          width={150}
                          height={100}
                          className={styles.versionImage}
                        />
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Actions */}
      <div className={styles.applicationActions}>
        <Link
          href={`/dashboard/applications/${application.application_id}/edit`}
          className={`${styles.actionLink} ${styles.editLink}`}
          onClick={() =>
            trackNavigation('navigate_to_edit_application', {
              applicationId: application.application_id,
            })
          }
        >
          Edit
        </Link>
        <button
          className={`${styles.actionButton} ${styles.deleteButton} ${
            application.is_active || isDeleting ? styles.disabled : ''
          }`}
          onClick={() =>
            !application.is_active && !isDeleting && handleDelete()
          }
          disabled={application.is_active || isDeleting}
          title={
            application.is_active
              ? 'Cannot delete active application. Please deactivate first.'
              : 'Delete application'
          }
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
