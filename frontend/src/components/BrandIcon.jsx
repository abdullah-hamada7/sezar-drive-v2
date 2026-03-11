/**
 * BrandIcon — Modern 3-spoke steering wheel (Option A).
 * Three rim arcs separated by spoke gaps, center hub, three connecting spokes.
 * Drop-in replacement for any lucide icon in brand-logo positions.
 */
export default function BrandIcon({ size = 20, className = '', ...props }) {
  // Wheel geometry
  const cx = 12, cy = 12, r = 8.5, hub = 2.8;

  // Spoke angles: 150° (left), 30° (right), 270° (bottom)
  const spokes = [150, 30, 270];
  const toRad = (deg) => (deg * Math.PI) / 180;

  // Build three rim arcs (the gaps between spokes)
  // Each arc spans from one spoke to the next
  const gapDeg = 18; // gap half-width in degrees at rim
  const arcPairs = [
    [150 + gapDeg, 30 - gapDeg + 360],   // left spoke → right spoke (over top)
    [30 + gapDeg, 270 - gapDeg],          // right spoke → bottom spoke
    [270 + gapDeg, 150 - gapDeg + 360],   // bottom spoke → left spoke
  ];

  const arcPath = (startDeg, endDeg) => {
    const s = toRad(startDeg);
    const e = toRad(endDeg);
    const x1 = cx + r * Math.cos(s);
    const y1 = cy - r * Math.sin(s);
    const x2 = cx + r * Math.cos(e);
    const y2 = cy - r * Math.sin(e);
    let sweep = endDeg - startDeg;
    if (sweep < 0) sweep += 360;
    const large = sweep > 180 ? 1 : 0;
    // SVG arc goes clockwise (sweep=1) when angles decrease in math coords
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  // Spoke lines from hub edge to rim edge
  const spokeLines = spokes.map((deg) => {
    const rad = toRad(deg);
    return {
      x1: cx + hub * Math.cos(rad),
      y1: cy - hub * Math.sin(rad),
      x2: cx + r * Math.cos(rad),
      y2: cy - r * Math.sin(rad),
    };
  });

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
      {...props}
    >
      {/* Three rim arcs */}
      {arcPairs.map(([s, e], i) => (
        <path key={`arc-${i}`} d={arcPath(s, e)} />
      ))}
      {/* Center hub */}
      <circle cx={cx} cy={cy} r={hub} />
      {/* Three spokes */}
      {spokeLines.map((l, i) => (
        <line key={`spoke-${i}`} x1={l.x1.toFixed(2)} y1={l.y1.toFixed(2)} x2={l.x2.toFixed(2)} y2={l.y2.toFixed(2)} strokeWidth="2.2" />
      ))}
    </svg>
  );
}
