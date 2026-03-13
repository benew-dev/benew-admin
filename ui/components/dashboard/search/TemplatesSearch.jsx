// ui/components/dashboard/search/TemplatesSearch.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { MdSearch } from 'react-icons/md';
import styles from './search.module.css';

function TemplatesSearch({ placeholder, onFilterChange, currentFilters = {} }) {
  const [searchTerm, setSearchTerm] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    const templateName = currentFilters.template_name || '';
    setSearchTerm(templateName);
  }, [currentFilters.template_name]);

  const notifyFilterChange = (term) => {
    if (onFilterChange) {
      const newFilters = {
        ...currentFilters,
        template_name: term.trim() || undefined,
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
        id="searchTemplate"
        type="text"
        placeholder={placeholder}
        className={styles.input}
        value={searchTerm}
        onChange={handleSearchChange}
      />
    </div>
  );
}

export default TemplatesSearch;
