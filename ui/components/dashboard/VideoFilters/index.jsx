// ui/components/dashboard/VideoFilters/index.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  MdFilterList,
  MdClose,
  MdClear,
  MdCheckBox,
  MdCheckBoxOutlineBlank,
} from 'react-icons/md';
import styles from './videoFilters.module.css';

const VideoFilters = ({ onFilterChange, currentFilters = {} }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    status: [],
  });
  const [categorySearch, setCategorySearch] = useState('');

  const filterRef = useRef(null);

  // Initialiser les filtres depuis les filtres actuels
  useEffect(() => {
    const category = currentFilters.category || [];
    const level = currentFilters.level || [];
    const status = currentFilters.status || [];

    setActiveFilters({
      category: Array.isArray(category) ? category : [category].filter(Boolean),
      level: Array.isArray(level) ? level : [level].filter(Boolean),
      status: Array.isArray(status) ? status : [status].filter(Boolean),
    });
  }, [currentFilters]);

  // Fermer le filtre en cliquant à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compter le nombre total de filtres actifs
  const totalActiveFilters =
    activeFilters.status.length + (categorySearch.trim() ? 1 : 0);

  // Fonction pour notifier le changement de filtre
  const notifyFilterChange = (statusFilters, catSearch) => {
    if (onFilterChange) {
      const serverFilters = { ...currentFilters };
      if (catSearch.trim()) serverFilters.category = catSearch.trim();
      else delete serverFilters.category;
      if (statusFilters.length > 0) serverFilters.status = statusFilters;
      else delete serverFilters.status;
      onFilterChange(serverFilters);
    }
  };

  // Gérer l'ajout/suppression d'un filtre
  const handleFilterToggle = (filterType, value) => {
    const current = [...activeFilters[filterType]];
    const index = current.indexOf(value);

    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(value);
    }

    const newActiveFilters = {
      ...activeFilters,
      [filterType]: current,
    };

    setActiveFilters(newActiveFilters);
    notifyFilterChange(newActiveFilters);
  };

  // Réinitialiser tous les filtres
  const clearAllFilters = () => {
    setActiveFilters({ status: [] });
    setCategorySearch('');
    notifyFilterChange([], '');
  };

  // Vérifier si un filtre est actif
  const isFilterActive = (filterType, value) => {
    return activeFilters[filterType].includes(value);
  };

  return (
    <div className={styles.filterContainer} ref={filterRef}>
      <button
        className={`${styles.filterButton} ${totalActiveFilters > 0 ? styles.hasActiveFilters : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <MdFilterList className={styles.filterIcon} />
        <span>Filters</span>
        {totalActiveFilters > 0 && (
          <span className={styles.filterCount}>{totalActiveFilters}</span>
        )}
      </button>

      {isOpen && (
        <div className={styles.filterDropdown}>
          <div className={styles.filterHeader}>
            <h3>Filter Videos</h3>
            <div className={styles.headerActions}>
              {totalActiveFilters > 0 && (
                <button
                  className={styles.clearAllButton}
                  onClick={clearAllFilters}
                  type="button"
                >
                  <MdClear />
                  Clear All
                </button>
              )}
              <button
                className={styles.closeButton}
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <MdClose />
              </button>
            </div>
          </div>

          <div className={styles.filterContent}>
            {/* Filtre par Catégorie */}
            <div className={styles.filterSection}>
              <h4 className={styles.filterTitle}>Category</h4>
              <input
                type="text"
                placeholder="Search by category..."
                value={categorySearch}
                onChange={(e) => {
                  setCategorySearch(e.target.value);
                  notifyFilterChange(activeFilters.status, e.target.value);
                }}
                className={styles.categoryInput}
              />
            </div>

            {/* Filtre par Status */}
            <div className={styles.filterSection}>
              <h4 className={styles.filterTitle}>Status</h4>
              <div className={styles.filterOptions}>
                {filterOptions.status.map((option) => (
                  <button
                    key={option.value}
                    className={`${styles.filterOption} ${
                      isFilterActive('status', option.value)
                        ? styles.active
                        : ''
                    }`}
                    onClick={() => handleFilterToggle('status', option.value)}
                    type="button"
                  >
                    <div className={styles.checkbox}>
                      {isFilterActive('status', option.value) ? (
                        <MdCheckBox className={styles.checkedIcon} />
                      ) : (
                        <MdCheckBoxOutlineBlank
                          className={styles.uncheckedIcon}
                        />
                      )}
                    </div>
                    <span className={styles.optionLabel}>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoFilters;
