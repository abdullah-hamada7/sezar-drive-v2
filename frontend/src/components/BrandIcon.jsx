/**
 * BrandIcon — Realistic steering-wheel glyph.
 */
export default function BrandIcon({ size = 20, className = '', ...props }) {
  const iconSize = Number(size) || 20;
  const small = iconSize <= 20;
  const rimStroke = small ? 2.25 : 2;
  const spokeStroke = small ? 2.45 : 2.2;
  const accentStroke = small ? 2 : 1.8;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={rimStroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      shapeRendering="geometricPrecision"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r={small ? '2.25' : '2.1'} />

      <path d="M12 10.2V5.6" strokeWidth={spokeStroke} />
      <path d="M10.3 12.8L6.4 15.6" strokeWidth={spokeStroke} />
      <path d="M13.7 12.8L17.6 15.6" strokeWidth={spokeStroke} />

      <path d="M6.6 8.2A6.8 6.8 0 0 1 9.2 6.1" strokeWidth={accentStroke} />
      <path d="M17.4 8.2A6.8 6.8 0 0 0 14.8 6.1" strokeWidth={accentStroke} />
      <path d="M8.1 17A6.8 6.8 0 0 0 15.9 17" strokeWidth={accentStroke} />
    </svg>
  );
}
