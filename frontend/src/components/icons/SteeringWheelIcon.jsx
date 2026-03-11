export default function SteeringWheelIcon({ size = 24, className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.25" />
      <path d="M12 3v6.5" />
      <path d="M4.5 15.5h5.25" />
      <path d="M19.5 15.5h-5.25" />
      <path d="M12 14.25 9.75 18" />
      <path d="M12 14.25 14.25 18" />
    </svg>
  );
}
