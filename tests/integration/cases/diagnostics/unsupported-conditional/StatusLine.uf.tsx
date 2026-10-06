// UF3025 unsupported-conditional: `message || <p>…</p>` as a child; write
// `message ? message : <p>…</p>`.
export interface StatusLineProps {
  message?: string;
}

export default function StatusLine({ message }: StatusLineProps) {
  return <div role="status">{message || <p>All good.</p>}</div>;
}
