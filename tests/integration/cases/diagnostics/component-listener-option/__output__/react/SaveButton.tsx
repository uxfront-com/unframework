export interface SaveButtonEvents {
  onSave?: () => void;
}

export function SaveButton({ onSave }: SaveButtonEvents) {
  return (
    <button type="button" onClick={() => onSave?.()}>
      Save
    </button>
  );
}
