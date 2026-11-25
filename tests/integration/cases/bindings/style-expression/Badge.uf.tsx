export interface BadgeProps {
  label: string;
  tone?: string;
}

// Its root's style is bound to a declaration list, which a consumer's `style` merges over.
export default function Badge({ label, tone }: BadgeProps) {
  return (
    <span class="badge" style={tone}>
      {label}
    </span>
  );
}
