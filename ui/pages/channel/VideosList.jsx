// ui/pages/channel/VideosList.jsx
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { MdAdd } from 'react-icons/md';
import styles from '@/ui/styling/dashboard/channel/videosList.module.css';
import VideoFilters from '@/ui/components/dashboard/VideoFilters';
import VideoSearch from '@/ui/components/dashboard/search/VideoSearch';
import { getFilteredVideos } from '@/app/dashboard/channel/actions';
import {
  trackUI,
  trackNavigation,
  trackDatabaseError,
} from '@/utils/monitoring';

// Helper pour formater la durée en mm:ss
function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Helper pour le label de catégorie
const CATEGORY_LABELS = {
  tutorial: 'Tutorial',
  overview: 'Overview',
  demo: 'Demo',
  setup: 'Setup',
  tips: 'Tips',
};

export default function VideosList({ data }) {
  const router = useRouter();
  const [videos, setVideos] = useState(data);
  const [isPending, startTransition] = useTransition();
  const [currentFilters, setCurrentFilters] = useState({});
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    setVideos(data);
    trackUI('videos_list_mounted', { count: data.length });
  }, [data]);

  const handleFilterChange = (newFilters) => {
    setCurrentFilters(newFilters);
    setError(null);

    trackUI('video_filter_changed', {
      filtersCount: Object.keys(newFilters).length,
    });

    startTransition(async () => {
      try {
        const filteredData = await getFilteredVideos(newFilters);
        setVideos(filteredData);

        trackUI('video_filter_applied_successfully', {
          resultsCount: filteredData.length,
        });
      } catch (error) {
        console.error('Filter error:', error);
        setError('Failed to filter videos. Please try again.');
        trackDatabaseError(error, 'filter_videos_client');
      }
    });
  };

  const clearAllFilters = () => {
    setCurrentFilters({});
    setError(null);

    trackUI('video_filters_cleared');

    startTransition(async () => {
      try {
        const allData = await getFilteredVideos({});
        setVideos(allData);
      } catch (error) {
        console.error('Clear filters error:', error);
        setError('Failed to clear filters. Please refresh the page.');
        trackDatabaseError(error, 'clear_video_filters_client');
      }
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this video?')) {
      trackUI('video_delete_cancelled', { videoId: id });
      return;
    }

    setDeleteId(id);
    setIsDeleting(true);

    trackUI('video_delete_started', { videoId: id });

    try {
      const response = await fetch(`/api/dashboard/channel/${id}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        trackUI('video_delete_successful', { videoId: id });
        router.refresh();
      }
    } catch (error) {
      console.error('Delete error:', error);
      setError('Failed to delete video. Please try again.');
      trackDatabaseError(error, 'delete_video_client', { videoId: id });
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const handleNavigate = (path, videoId) => {
    trackNavigation('video_navigation', { path, videoId });
    router.push(path);
  };

  const hasActiveFilters = Object.keys(currentFilters).length > 0;

  return (
    <div className={styles.videosContainer}>
      {/* Header */}
      <div className={styles.top}>
        <VideoSearch
          placeholder="Search for a video..."
          onFilterChange={handleFilterChange}
          currentFilters={currentFilters}
        />
        <VideoFilters
          onFilterChange={handleFilterChange}
          currentFilters={currentFilters}
        />
        <button
          onClick={() => handleNavigate('/dashboard/channel/add', null)}
          className={styles.addButton}
          type="button"
        >
          <MdAdd /> Add Video
        </button>
      </div>

      {/* Loading */}
      {isPending && (
        <div className={styles.loading}>
          <span className={styles.loadingSpinner}></span>
          Filtering videos...
        </div>
      )}

      {/* Erreurs */}
      {error && (
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          {error}
          <button
            className={styles.retryButton}
            onClick={() => handleFilterChange(currentFilters)}
          >
            Retry
          </button>
        </div>
      )}

      {/* Grid */}
      <div className={styles.videosGrid}>
        {videos && videos.length > 0 ? (
          videos.map((video) => (
            <div
              key={video.video_id}
              className={`${styles.videoCard} ${video.is_active ? styles.activeCard : styles.inactiveCard}`}
            >
              {/* Status indicator */}
              <div
                className={`${styles.statusIndicator} ${video.is_active ? styles.activeIndicator : styles.inactiveIndicator}`}
              >
                <span className={styles.statusDot}></span>
                <span className={styles.statusText}>
                  {video.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Thumbnail */}
              <div className={styles.videoThumbnail}>
                {video.video_thumbnail_id ? (
                  <Image
                    src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_300,h_170/${video.video_thumbnail_id}`}
                    alt={video.video_title}
                    width={300}
                    height={170}
                    className={styles.thumbnailImage}
                  />
                ) : (
                  <div className={styles.thumbnailPlaceholder}>
                    <span>🎬</span>
                  </div>
                )}
                {/* Durée en overlay */}
                {video.video_duration_seconds && (
                  <span className={styles.durationBadge}>
                    {formatDuration(video.video_duration_seconds)}
                  </span>
                )}
              </div>

              {/* Détails */}
              <div className={styles.videoDetails}>
                <div className={styles.titleSection}>
                  <h2>{video.video_title}</h2>
                </div>

                <div className={styles.metaRow}>
                  <span className={styles.categoryBadge}>
                    {CATEGORY_LABELS[video.video_category] ||
                      video.video_category}
                  </span>
                  <span className={styles.levelBadge}>
                    Level {video.video_level}
                  </span>
                </div>

                {video.series_name && (
                  <p className={styles.seriesInfo}>
                    📚 {video.series_name}
                    {video.series_order && ` — #${video.series_order}`}
                  </p>
                )}

                <div className={styles.statsRow}>
                  <span>👁 {video.views_count} views</span>
                </div>

                {video.video_tags?.length > 0 && (
                  <div className={styles.tagsRow}>
                    {video.video_tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className={styles.tagBadge}>
                        {tag}
                      </span>
                    ))}
                    {video.video_tags.length > 3 && (
                      <span className={styles.tagBadge}>
                        +{video.video_tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className={styles.videoActions}>
                <Link
                  href={`/dashboard/channel/${video.video_id}`}
                  className={`${styles.actionLink} ${styles.viewLink}`}
                >
                  View
                </Link>
                <Link
                  href={`/dashboard/channel/${video.video_id}/edit`}
                  className={`${styles.actionLink} ${styles.editLink}`}
                >
                  Edit
                </Link>
                <button
                  disabled={video.is_active || isDeleting}
                  className={`${styles.actionButton} ${styles.deleteButton} ${video.is_active ? styles.disabled : ''}`}
                  onClick={() =>
                    !video.is_active && handleDelete(video.video_id)
                  }
                  title={
                    video.is_active
                      ? 'Deactivate before deleting'
                      : 'Delete video'
                  }
                >
                  {isDeleting && deleteId === video.video_id
                    ? 'Deleting...'
                    : 'Delete'}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.noResults}>
            <div className={styles.noResultsIcon}>🎬</div>
            <p>
              {hasActiveFilters
                ? 'No videos match your current filters.'
                : 'No videos available.'}
            </p>
            {hasActiveFilters && (
              <button
                className={styles.clearFiltersButton}
                onClick={clearAllFilters}
                disabled={isPending}
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
