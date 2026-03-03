import { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';

/**
 * A reusable animated counter component that counts up to a target value.
 * @param {number|string} value - The target value to animate towards.
 * @param {number} duration - Animation duration in seconds.
 * @param {string} prefix - Optional string prefix (e.g. "$").
 * @param {string} suffix - Optional string suffix (e.g. " SAR").
 */
export default function AnimatedCounter({ value, duration = 1.5, prefix = '', suffix = '' }) {
  const nodeRef = useRef();
  
  // Extract number from string if necessary (e.g., "120 SAR" -> 120)
  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, "")) : value;
  
  useEffect(() => {
    const node = nodeRef.current;
    
    const controls = animate(0, numericValue, {
      duration,
      onUpdate(value) {
        node.textContent = `${prefix}${Math.round(value).toLocaleString()}${suffix}`;
      },
      ease: "easeOut"
    });

    return () => controls.stop();
  }, [numericValue, duration, prefix, suffix]);

  return <span ref={nodeRef}>0</span>;
}
