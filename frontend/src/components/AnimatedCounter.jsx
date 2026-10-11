import { useState, useEffect, useRef } from 'react';

/**
 * AnimatedCounter — Smooth count-up animation for numeric values
 * Respects user's prefers-reduced-motion setting.
 */
export default function AnimatedCounter({ value, duration = 650 }) {
  const numericValue = typeof value === 'number' ? value : parseFloat(value);
  const isNumeric = !Number.isNaN(numericValue) && Number.isFinite(numericValue);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  const [displayValue, setDisplayValue] = useState(isNumeric ? numericValue : value);
  const prevValueRef = useRef(numericValue);
  const startTimeRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!isNumeric || prefersReducedMotion) return;

    const startVal = prevValueRef.current;
    const endVal = numericValue;
    prevValueRef.current = endVal;

    if (startVal === endVal) return;

    startTimeRef.current = null;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * easedProgress);

      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endVal);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    const timer = setTimeout(() => {
      setDisplayValue(endVal);
    }, duration + 50);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      clearTimeout(timer);
    };
  }, [numericValue, isNumeric, prefersReducedMotion, duration]);

  if (!isNumeric || prefersReducedMotion) return <>{value}</>;

  return <>{displayValue}</>;
}
