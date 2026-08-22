import { TIME_SLOTS } from '../../data/cblockData';
import styles from './TimeSelector.module.css';

export default function TimeSelector({ selectedTime, onChange }) {
  return (
    <div className={styles.wrapper} id="time-selector">
      <span className={styles.label}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Reading at
      </span>
      <div className={styles.pills}>
        {TIME_SLOTS.map((slot) => (
          <button
            key={slot}
            id={`time-${slot.replace(':', '')}`}
            className={`${styles.pill} ${selectedTime === slot ? styles.active : ''}`}
            onClick={() => onChange(slot)}
          >
            {slot}
          </button>
        ))}
      </div>
    </div>
  );
}
