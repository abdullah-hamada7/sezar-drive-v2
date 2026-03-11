/**
 * BrandIcon — Shield with a curving road/highway inside.
 * Matches Option C: shield outline + sweeping road perspective.
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
      {/* Shield outline */}
      <path d="M12 2L4 5.5v5.5c0 5.5 3.5 10 8 12 4.5-2 8-6.5 8-12V5.5L12 2z" />

      {/* Curving road — sweeps from bottom-left to upper-right inside the shield */}
      <path
        d="M8 18c1-3 2.5-5.5 5-7.5 1.5-1.2 2.5-2 3.5-3"
        strokeWidth="2.2"
        fill="none"
      />
      {/* Second lane edge for road width */}
      <path
        d="M6.5 16.5c1.5-2.5 3-4.5 5-6 1.5-1.2 2.8-2 4-3"
        strokeWidth="0.8"
        opacity="0.5"
        fill="none"
      />
    </svg>
  );
}
