// ui/components/dashboard/search/VideoSearch.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { MdSearch } from 'react-icons/md';
import styles from './search.module.css';

function VideoSearch({ placeholder, onFilterChange, currentFilters = {} }) {
  const [searchTerm, setSearchTerm] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    const videoTitle = currentFilters.video_title || '';
    setSearchTerm(videoTitle);
  }, [currentFilters.video_title]);

  const notifyFilterChange = (term) => {
    if (onFilterChange) {
      const newFilters = {
        ...currentFilters,
        video_title: term.trim() || undefined,
      };

      Object.keys(newFilters).forEach((key) => {
        if (newFilters[key] === undefined) {
          delete newFilters[key];
        }
      });

      onFilterChange(newFilters);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      notifyFilterChange(value);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.container}>
      <MdSearch alt="search icon" />
      <input
        id="searchVideo"
        type="text"
        placeholder={placeholder}
        className={styles.input}
        value={searchTerm}
        onChange={handleSearchChange}
      />
    </div>
  );
}

export default VideoSearch;
