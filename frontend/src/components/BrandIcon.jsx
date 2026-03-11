/**
 * BrandIcon — Shield with road inside.
 * Drop-in replacement for any lucide icon in brand-logo positions.
 * Accepts `size` and any extra SVG props.
 */
export default function BrandIcon({ size = 20, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Shield outline */}
      <path d="M12 2l7.5 3.5v5c0 5.25-3.5 9.5-7.5 11.5-4-2-7.5-6.25-7.5-11.5v-5L12 2z" />

      {/* Road — two parallel lane lines converging toward horizon */}
      <line x1="10.5" y1="17" x2="11.2" y2="8" />
      <line x1="13.5" y1="17" x2="12.8" y2="8" />
      {/* Center dashed lane marker */}
      <line x1="12" y1="10" x2="12" y2="11.5" strokeDasharray="1.2 1.2" />
      <line x1="12" y1="13" x2="12" y2="14.5" strokeDasharray="1.2 1.2" />
      <line x1="12" y1="15.5" x2="12" y2="17" strokeDasharray="1.2 1.2" />
    </svg>
  );
}
