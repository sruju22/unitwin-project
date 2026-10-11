import styles from './Skeleton.module.css';

export default function Skeleton({
  width = '100%',
  height = '16px',
  borderRadius = '6px',
  className = '',
  style = {},
}) {
  return (
    <span
      className={`${styles.skeleton} ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}
