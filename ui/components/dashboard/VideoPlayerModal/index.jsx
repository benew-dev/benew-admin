// ui/components/dashboard/VideoPlayerModal/index.jsx
'use client';

import { useEffect, useRef } from 'react';
import { MdClose } from 'react-icons/md';
import { CldVideoPlayer } from 'next-cloudinary';
import 'next-cloudinary/dist/cld-video-player.css';
import styles from './videoPlayerModal.module.css';

/**
 * VideoPlayerModal
 *
 * Props:
 * - video: objet vidéo complet (video_cloudinary_id, video_title, etc.)
 * - onClose: fonction pour fermer le modal
 */
export default function VideoPlayerModal({ video, onClose }) {
  const overlayRef = useRef(null);

  // Fermer avec la touche Échap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);

    // Bloquer le scroll du body pendant que le modal est ouvert
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Fermer en cliquant sur l'overlay (pas sur le contenu)
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  if (!video) return null;

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Playing: ${video.video_title}`}
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleBlock}>
            <h2 className={styles.modalTitle}>{video.video_title}</h2>
            <div className={styles.modalMeta}>
              {video.video_category && (
                <span className={styles.metaBadge}>{video.video_category}</span>
              )}
              {video.video_level && (
                <span className={styles.metaBadge}>
                  Level {video.video_level}
                </span>
              )}
            </div>
          </div>
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
            aria-label="Close video player"
          >
            <MdClose />
          </button>
        </div>

        {/* Player */}
        <div className={styles.playerWrapper}>
          <CldVideoPlayer
            id={`player-${video.video_id}`}
            src={video.video_cloudinary_id}
            width="1920"
            height="1080"
            autoPlay
            controls
            className={styles.player}
          />
        </div>

        {/* Footer optionnel */}
        {video.video_description && (
          <div className={styles.modalFooter}>
            <p className={styles.description}>{video.video_description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
