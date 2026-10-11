import { useState, useEffect, useRef } from 'react';
import styles from './CommandPalette.module.css';

const COMMAND_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    desc: 'Campus operations overview, active buildings & KPIs',
    category: 'Navigation',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: 'campus',
    label: 'Campus Twin',
    desc: 'Interactive 2D satellite map & spatial layout',
    category: 'Navigation',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="3 9 12 2 21 9 21 20 3 20" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    desc: 'Deep historical trends and cross-system correlation',
    category: 'Navigation',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: 'occupancy',
    label: 'Occupancy',
    desc: 'Zone density, lecture schedules & headcounts',
    category: 'Navigation',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'energy',
    label: 'Energy & Solar Performance',
    desc: 'Current demand profiles, photovoltaic generation & grid import',
    category: 'Navigation',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    id: 'congestion',
    label: 'Congestion',
    desc: 'Pathway flow, choke points & corridor pedestrian density',
    category: 'Navigation',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12h18M3 6h18M3 18h18" />
        <circle cx="7" cy="6" r="2" fill="currentColor" stroke="none" />
        <circle cx="17" cy="12" r="2" fill="currentColor" stroke="none" />
        <circle cx="7" cy="18" r="2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    desc: 'Facility service dispatches, AHU units & work orders',
    category: 'Navigation',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    id: 'alerts',
    label: 'Alerts & Incidents',
    desc: 'Critical alarm audit log & incident resolution',
    category: 'Navigation',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
];

export default function CommandPalette({ isOpen, onClose, onSelectPage }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prevQuery, setPrevQuery] = useState(query);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const inputRef = useRef(null);

  // Sync state changes during render (idiomatic React without cascading effects)
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }

  if (prevQuery !== query) {
    setPrevQuery(query);
    setSelectedIndex(0);
  }

  const filteredItems = COMMAND_ITEMS.filter((item) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      item.label.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Keyboard navigation inside the palette
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredItems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredItems.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex].id);
      }
    }
  };

  const handleSelect = (pageId) => {
    onSelectPage(pageId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div className={styles.modal}>
        {/* Search header */}
        <div className={styles.searchHeader}>
          <svg
            className={styles.searchIcon}
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Search pages or type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className={styles.kbdChip}>ESC</span>
        </div>

        {/* Results */}
        <div className={styles.resultsList}>
          {filteredItems.length > 0 && (
            <div className={styles.sectionHeading}>Campus Modules</div>
          )}

          {filteredItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.id}
                className={`${styles.resultItem} ${
                  isSelected ? styles.selected : ''
                }`}
                onClick={() => handleSelect(item.id)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className={styles.itemIcon}>{item.icon}</div>
                <div className={styles.itemDetails}>
                  <span className={styles.itemLabel}>{item.label}</span>
                  <span className={styles.itemDesc}>{item.desc}</span>
                </div>
                <span className={styles.jumpTag}>
                  <span>Jump</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </button>
            );
          })}

          {filteredItems.length === 0 && (
            <div className={styles.noResults}>
              No matching pages found for "{query}"
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className={styles.footer}>
          <div className={styles.footerKeys}>
            <span className={styles.keyHint}>
              <kbd>↑</kbd> <kbd>↓</kbd> Navigate
            </span>
            <span className={styles.keyHint}>
              <kbd>↵</kbd> Select
            </span>
            <span className={styles.keyHint}>
              <kbd>ESC</kbd> Close
            </span>
          </div>
          <span>UNITWIN Digital Twin</span>
        </div>
      </div>
    </div>
  );
}
