'use client';

import { useState, useEffect, useRef } from 'react';
import {
  MdFilterList,
  MdClose,
  MdClear,
  MdCheckBox,
  MdCheckBoxOutlineBlank,
  MdMonitor,
  MdPhoneIphone,
} from 'react-icons/md';
import styles from './templateFilters.module.css';

const TemplateFilters = ({ onFilterChange, currentFilters = {} }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    platform: [],
    status: [],
  });

  const filterRef = useRef(null);

  // Options de filtres
  // "platform" filtre sur template_has_web / template_has_mobile (voir actions.js)
  const filterOptions = {
    platform: [
      { value: 'web', label: 'Web', icon: <MdMonitor /> },
      { value: 'mobile', label: 'Mobile', icon: <MdPhoneIphone /> },
    ],
    status: [
      { value: 'true', label: 'Active' },
      { value: 'false', label: 'Inactive' },
    ],
  };

  // Initialiser les filtres depuis les filtres actuels
  useEffect(() => {
    const platform = currentFilters.platform || [];
    const status = currentFilters.status || [];

    setActiveFilters({
      platform: Array.isArray(platform) ? platform : [platform].filter(Boolean),
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
  const totalActiveFilters = Object.values(activeFilters).flat().length;

  // Notifier le changement de filtre vers la Server Action
  const notifyFilterChange = (filters) => {
    if (onFilterChange) {
      const serverFilters = {
        ...currentFilters, // Conserver les autres filtres (comme template_name)
      };

      if (filters.platform.length > 0) {
        serverFilters.platform = filters.platform;
      } else {
        delete serverFilters.platform;
      }

      if (filters.status.length > 0) {
        serverFilters.status = filters.status;
      } else {
        delete serverFilters.status;
      }

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
    const emptyFilters = {
      platform: [],
      status: [],
    };

    setActiveFilters(emptyFilters);
    notifyFilterChange(emptyFilters);
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
            <h3>Filter Templates</h3>
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
            {/* Filtre par Plateforme */}
            <div className={styles.filterSection}>
              <h4 className={styles.filterTitle}>Platform</h4>
              <div className={styles.filterOptions}>
                {filterOptions.platform.map((option) => (
                  <button
                    key={option.value}
                    className={`${styles.filterOption} ${
                      isFilterActive('platform', option.value)
                        ? styles.active
                        : ''
                    }`}
                    onClick={() => handleFilterToggle('platform', option.value)}
                    type="button"
                  >
                    <div className={styles.checkbox}>
                      {isFilterActive('platform', option.value) ? (
                        <MdCheckBox className={styles.checkedIcon} />
                      ) : (
                        <MdCheckBoxOutlineBlank
                          className={styles.uncheckedIcon}
                        />
                      )}
                    </div>
                    <span className={styles.optionIcon}>{option.icon}</span>
                    <span className={styles.optionLabel}>{option.label}</span>
                  </button>
                ))}
              </div>
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

export default TemplateFilters;
