// UF1102 invalid-component: an exported function that returns JSX under a camelCase name, and a
// component that returns a conditional instead of an element; each has a likely fix.
export function statusBadge() {
  return <span class="badge">Online</span>;
}

export interface PresenceProps {
  online: boolean;
}

export function Presence({ online }: PresenceProps) {
  return online ? <span>Online</span> : <span>Away</span>;
}
