import { useMemo, useState } from 'react';

export default function BrandIcon({
  height = 24,
  className = '',
  variant = 'full',
  alt = 'Sezar Drive',
  style,
  ...props
}) {
  const [failed, setFailed] = useState(false);

  const src = useMemo(() => {
    if (failed) return '/favicon.png';
    if (variant === 'mark') return '/brand-mark.svg';
    return '/brand-full.svg';
  }, [failed, variant]);

  const imgStyle = {
    height,
    width: variant === 'mark' ? height : 'auto',
    display: 'block',
    objectFit: 'contain',
    ...style,
  };

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={imgStyle}
      onError={() => setFailed(true)}
      {...props}
    />
  );
}
