// ui/components/dashboard/CategoryAutocomplete/index.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './categoryAutocomplete.module.css';

/**
 * CategoryAutocomplete
 *
 * Props:
 * - value: string — valeur actuelle
 * - onChange: (value: string) => void — callback quand la valeur change
 * - existingCategories: string[] — catégories déjà présentes en base
 * - placeholder: string — placeholder de l'input
 * - hasError: boolean — afficher l'état d'erreur
 * - id: string — id HTML de l'input
 */
export default function CategoryAutocomplete({
  value,
  onChange,
  existingCategories = [],
  placeholder = 'Ex: tutoriel, présentation, démo...',
  hasError = false,
  id = 'category',
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Sync avec la valeur externe
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Fermer si clic en dehors
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculer les suggestions quand l'input change
  const handleInputChange = (e) => {
    const raw = e.target.value;
    setInputValue(raw);
    onChange(raw);
    setHighlightedIndex(-1);

    const trimmed = raw.trim().toLowerCase();

    if (trimmed.length === 0) {
      // Input vide → montrer toutes les catégories existantes
      setSuggestions(existingCategories);
      setIsOpen(existingCategories.length > 0);
      return;
    }

    // Filtrer : catégories qui contiennent le texte tapé
    const filtered = existingCategories.filter((cat) =>
      cat.toLowerCase().includes(trimmed),
    );

    setSuggestions(filtered);
    setIsOpen(filtered.length > 0);
  };

  const handleFocus = () => {
    const trimmed = inputValue.trim().toLowerCase();
    if (trimmed.length === 0) {
      setSuggestions(existingCategories);
      setIsOpen(existingCategories.length > 0);
    } else {
      const filtered = existingCategories.filter((cat) =>
        cat.toLowerCase().includes(trimmed),
      );
      setSuggestions(filtered);
      setIsOpen(filtered.length > 0);
    }
    setHighlightedIndex(-1);
  };

  const handleSelect = (cat) => {
    setInputValue(cat);
    onChange(cat);
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  // Navigation clavier
  const handleKeyDown = (e) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        handleSelect(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Vérifier si la valeur actuelle est une catégorie existante exacte
  const isExistingCategory = existingCategories
    .map((c) => c.toLowerCase())
    .includes(inputValue.trim().toLowerCase());

  const isNewCategory = inputValue.trim().length > 0 && !isExistingCategory;

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`${styles.input} ${hasError ? styles.inputError : ''} ${
            isExistingCategory ? styles.inputExisting : ''
          } ${isNewCategory ? styles.inputNew : ''}`}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        />

        {/* Badge indiquant si c'est nouveau ou existant */}
        {inputValue.trim().length > 0 && (
          <span
            className={`${styles.badge} ${
              isExistingCategory ? styles.badgeExisting : styles.badgeNew
            }`}
          >
            {isExistingCategory ? '✓ Existing' : '+ New'}
          </span>
        )}
      </div>

      {/* Liste de suggestions */}
      {isOpen && suggestions.length > 0 && (
        <ul
          className={styles.dropdown}
          role="listbox"
          aria-label="Category suggestions"
        >
          {suggestions.map((cat, index) => (
            <li
              key={cat}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`${styles.suggestion} ${
                index === highlightedIndex ? styles.highlighted : ''
              }`}
              onMouseDown={(e) => {
                // onMouseDown au lieu de onClick pour éviter que onBlur ferme avant
                e.preventDefault();
                handleSelect(cat);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span className={styles.suggestionText}>{cat}</span>
              <span className={styles.suggestionBadge}>existing</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
