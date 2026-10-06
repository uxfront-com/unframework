export interface StatusIconProps {
  label: string;
  size?: number;
  colour?: string;
}

export default function StatusIcon({ label, size = 24, colour = "#1f6feb" }: StatusIconProps) {
  return (
    <svg class="status-icon" role="img" viewBox="0 0 24 24" width={size} height={size} fill="none">
      <title>{label}</title>
      <defs>
        <linearGradient id="status-icon-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color={colour} />
          <stop offset="1" stop-color="#0b3d91" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#status-icon-fill)" />
      <path
        d="M7 12.5l3 3 7-7"
        stroke="#ffffff"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
