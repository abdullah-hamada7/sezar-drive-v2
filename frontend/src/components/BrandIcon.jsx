import { useMemo, useState } from 'react';

export default function BrandIcon({
  size = 20,
  className = '',
  variant = 'mark',
  alt = 'Sezar Drive',
  ...props
}) {
  const [failed, setFailed] = useState(false);

  const src = useMemo(() => {
    if (failed) return '/favicon.png';
    if (variant === 'full') return '/brand-full.svg';
    return '/brand-mark.svg';
  }, [failed, variant]);

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={alt}
      className={className}
      style={{ width: size, height: size, display: 'block' }}
      onError={() => setFailed(true)}
      {...props}
    />
  );
}
