/** Plately mark — pizza-style option wheel. */
export function PlatelyLogo({
  className,
  size = 36,
  animated = false,
}: {
  className?: string;
  size?: number;
  /** Gentle continuous spin (logo mark only). */
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={className}
      aria-hidden
      style={animated ? { animation: "plately-wheel 18s linear infinite" } : undefined}
    >
      {/* Crust */}
      <circle cx="20" cy="20" r="19" fill="#b8894a" />
      <circle cx="20" cy="20" r="16.8" fill="#f0e2c4" />

      {/* Six meal-option slices */}
      <path d="M20 20 L20 3.5 A16.5 16.5 0 0 1 34.29 11.75 Z" fill="#2f6b4f" />
      <path d="M20 20 L34.29 11.75 A16.5 16.5 0 0 1 34.29 28.25 Z" fill="#c45c3a" />
      <path d="M20 20 L34.29 28.25 A16.5 16.5 0 0 1 20 36.5 Z" fill="#6b8f5a" />
      <path d="M20 20 L20 36.5 A16.5 16.5 0 0 1 5.71 28.25 Z" fill="#d4a84b" />
      <path d="M20 20 L5.71 28.25 A16.5 16.5 0 0 1 5.71 11.75 Z" fill="#3d7a5c" />
      <path d="M20 20 L5.71 11.75 A16.5 16.5 0 0 1 20 3.5 Z" fill="#e8c9a0" />

      {/* Slice dividers */}
      <g stroke="#f7efe0" strokeWidth="0.85" strokeLinecap="round" opacity="0.9">
        <line x1="20" y1="20" x2="20" y2="3.5" />
        <line x1="20" y1="20" x2="34.29" y2="11.75" />
        <line x1="20" y1="20" x2="34.29" y2="28.25" />
        <line x1="20" y1="20" x2="20" y2="36.5" />
        <line x1="20" y1="20" x2="5.71" y2="28.25" />
        <line x1="20" y1="20" x2="5.71" y2="11.75" />
      </g>

      {/* Topping dots — different options on each slice */}
      <circle cx="24.2" cy="9.2" r="1.15" fill="#f0e2c4" opacity="0.95" />
      <circle cx="27.8" cy="12.4" r="0.85" fill="#d4a84b" />
      <circle cx="29.6" cy="20" r="1.2" fill="#f0e2c4" />
      <circle cx="27.2" cy="26.8" r="0.9" fill="#2f6b4f" opacity="0.85" />
      <circle cx="20" cy="30.6" r="1.1" fill="#c45c3a" opacity="0.9" />
      <circle cx="12.4" cy="27.2" r="0.95" fill="#f0e2c4" />
      <circle cx="10.2" cy="20" r="1.15" fill="#e8c9a0" />
      <circle cx="12.8" cy="12.6" r="0.85" fill="#2f6b4f" opacity="0.75" />
      <circle cx="17.2" cy="10.4" r="0.7" fill="#c45c3a" opacity="0.8" />

      {/* Hub — plate / active option */}
      <circle cx="20" cy="20" r="4.2" fill="#f7efe0" stroke="#b8894a" strokeWidth="1.1" />
      <circle cx="20" cy="20" r="2.2" fill="#2f6b4f" />
    </svg>
  );
}
