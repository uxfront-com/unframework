export interface SaveIndicatorProps {
  saving: boolean;
  changes: number;
  savedAt?: string;
}

export default function SaveIndicator({ saving, changes, savedAt }: SaveIndicatorProps) {
  return (
    <p className="save-indicator" role="status">
      {saving ? <em>Saving</em> : "Saved"}, {changes === 1 ? "1 change" : `${changes} changes`}
      {savedAt ? <time dateTime={savedAt}>{" at " + savedAt}</time> : " just now"}
    </p>
  );
}
