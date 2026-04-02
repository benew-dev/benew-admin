// ui/pages/channel/SingleVideo.jsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MdArrowBack, MdCheck, MdClose, MdPlayCircle } from 'react-icons/md';
import styles from '@/ui/styling/dashboard/channel/singleVideo.module.css';
import VideoPlayerModal from '@/ui/components/dashboard/VideoPlayerModal';
import {
  trackUI,
  trackNavigation,
  trackDatabaseError,
} from '@/utils/monitoring';

// Helper durée mm:ss
function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SingleVideo({ data }) {
  const router = useRouter();
  const [video, setVideo] = useState(data);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  useEffect(() => {
    setVideo(data);
    trackUI('single_video_mounted', {
      videoId: data?.video_id,
      videoTitle: data?.video_title,
    });
  }, [data]);

  if (!video) {
    return (
      <div className={styles.notFound}>
        <p>Video not found</p>
        <Link href="/dashboard/channel" className={styles.backButton}>
          <MdArrowBack /> Back to Channel
        </Link>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this video?')) {
      trackUI('video_delete_cancelled', { videoId: video.video_id });
      return;
    }

    setIsDeleting(true);
    trackUI('video_delete_started', { videoId: video.video_id });

    try {
      const response = await fetch(
        `/api/dashboard/channel/${video.video_id}/delete`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: video.video_id }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        trackUI('video_delete_successful', { videoId: video.video_id });
        router.push('/dashboard/channel?deleted=true');
      } else {
        throw new Error(data.message || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(error.message || 'Failed to delete video. Please try again.');
      trackDatabaseError(error, 'delete_video_client', {
        videoId: video.video_id,
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
    <div className={styles.singleVideoContainer}>
      {/* Modal player */}
      {isPlayerOpen && (
        <VideoPlayerModal
          video={video}
          onClose={() => {
            trackUI('video_player_closed_single', { videoId: video.video_id });
            setIsPlayerOpen(false);
          }}
        />
      )}

      <Link
        href="/dashboard/channel"
        className={styles.backButton}
        onClick={() => trackNavigation('back_to_channel_list')}
      >
        <MdArrowBack /> Back to Channel
      </Link>

      <h1>{video.video_title}</h1>

      {/* Status indicator */}
      <div
        className={`${styles.statusIndicator} ${video.is_active ? styles.active : styles.inactive}`}
      >
        {video.is_active ? (
          <>
            <MdCheck className={styles.statusIcon} />
            <span>Active Video</span>
          </>
        ) : (
          <>
            <MdClose className={styles.statusIcon} />
            <span>Inactive Video</span>
          </>
        )}
      </div>

      <div className={styles.videoDetails}>
        {/* Thumbnail + Play */}
        <div className={styles.videoPreview}>
          <div className={styles.thumbnailWrapper}>
            {video.video_thumbnail_id ? (
              <img
                src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_600,h_340/${video.video_thumbnail_id}`}
                alt={video.video_title}
                className={styles.thumbnailImage}
              />
            ) : (
              <div className={styles.thumbnailPlaceholder}>
                <span>🎬</span>
              </div>
            )}

            {/* Durée badge */}
            {video.video_duration_seconds && (
              <span className={styles.durationBadge}>
                {formatDuration(video.video_duration_seconds)}
              </span>
            )}

            {/* Bouton Play */}
            <button
              className={styles.playButton}
              onClick={() => {
                trackUI('video_player_opened_single', {
                  videoId: video.video_id,
                });
                setIsPlayerOpen(true);
              }}
              type="button"
              aria-label={`Watch ${video.video_title}`}
            >
              <MdPlayCircle className={styles.playIcon} />
              <span className={styles.playLabel}>Watch Video</span>
            </button>
          </div>
        </div>

        {/* Info */}
        <div className={styles.videoInfo}>
          {/* Badges catégorie + level */}
          <div className={styles.badgeRow}>
            {video.video_category && (
              <span className={styles.categoryBadge}>
                {video.video_category}
              </span>
            )}
          </div>

          {video.video_description && (
            <div className={styles.descriptionBlock}>
              <strong>Description</strong>
              <p>{video.video_description}</p>
            </div>
          )}

          {/* Tags */}
          {video.video_tags?.length > 0 && (
            <div className={styles.tagsBlock}>
              <strong>Tags</strong>
              <div className={styles.tagsRow}>
                {video.video_tags.map((tag, i) => (
                  <span key={i} className={styles.tagBadge}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className={styles.statsBlock}>
            <div className={styles.statItem}>
              <strong>Views</strong>
              <span className={styles.viewsCount}>
                👁 {video.views_count} views
              </span>
            </div>
            <div className={styles.statItem}>
              <strong>Status</strong>
              <span
                className={`${styles.statusBadge} ${video.is_active ? styles.activeBadge : styles.inactiveBadge}`}
              >
                {video.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Dates */}
          <div className={styles.dateBlock}>
            <p>
              <strong>Created:</strong>
              <span className={styles.dateValue}>
                {formatDate(video.created_at)}
              </span>
            </p>
            <p>
              <strong>Last Updated:</strong>
              <span className={styles.dateValue}>
                {formatDate(video.updated_at)}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.videoActions}>
        <Link
          href={`/dashboard/channel/${video.video_id}/edit`}
          className={`${styles.actionLink} ${styles.editLink}`}
          onClick={() =>
            trackNavigation('navigate_to_edit_video', {
              videoId: video.video_id,
            })
          }
        >
          Edit
        </Link>
        <button
          className={`${styles.actionButton} ${styles.deleteButton} ${
            video.is_active || isDeleting ? styles.disabled : ''
          }`}
          onClick={() => !video.is_active && !isDeleting && handleDelete()}
          disabled={video.is_active || isDeleting}
          title={
            video.is_active
              ? 'Cannot delete active video. Please deactivate first.'
              : 'Delete video'
          }
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
