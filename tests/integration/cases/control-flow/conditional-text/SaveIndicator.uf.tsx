export interface SaveIndicatorProps {
  saving: boolean;
  changes: number;
  savedAt?: string;
}

export default function SaveIndicator({ saving, changes, savedAt }: SaveIndicatorProps) {
  return (
    <p class="save-indicator" role="status">
      {saving ? <em>Saving</em> : "Saved"}
      {", "}
      {changes === 1 ? "1 change" : `${changes} changes`}
      {savedAt ? <time datetime={savedAt}>{" at " + savedAt}</time> : " just now"}
    </p>
  );
}
