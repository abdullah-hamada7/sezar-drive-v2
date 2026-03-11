/**
 * BrandIcon — Steering wheel icon.
 * Matches Option A from the logo options.
 * Drop-in replacement for any lucide icon in brand-logo positions.
 */
export default function BrandIcon({ size = 20, className = '', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Outer wheel ring */}
      <circle cx="12" cy="12" r="9" />
      {/* Inner hub */}
      <circle cx="12" cy="12" r="2.5" />
      {/* Three spokes at 210°, 330°, 90° */}
      <line x1="12" y1="9.5" x2="12" y2="3" />
      <line x1="9.83" y1="13.25" x2="4.5" y2="16.3" />
      <line x1="14.17" y1="13.25" x2="19.5" y2="16.3" />
    </svg>
  );
}
