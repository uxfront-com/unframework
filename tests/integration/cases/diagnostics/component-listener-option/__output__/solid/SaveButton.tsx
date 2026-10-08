export interface SaveButtonEvents {
  onSave?: () => void;
}

export function SaveButton(props: SaveButtonEvents) {
  return (
    <button type="button" onClick={() => props.onSave?.()}>
      Save
    </button>
  );
}
