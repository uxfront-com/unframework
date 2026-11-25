import { cx } from "./_unframework/cx";
import {
  type ComponentPropsWithRef,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface DraftEditorEvents {
  onSaved?: (count: number) => void;
}

export type DraftEditorAttributes = Omit<ComponentPropsWithRef<"section">, "onSaved" | "children">;

export default function DraftEditor({
  onSaved,
  className,
  style,
  ...attributes
}: DraftEditorEvents & DraftEditorAttributes) {
  const onSavedRef = useRef(onSaved);
  useLayoutEffect(() => {
    onSavedRef.current = onSaved;
  });

  const [saves, setSaves] = useState(0);
  const savesRef = useRef(saves);

  const [onShortcut] = useState(() => (event: KeyboardEvent) => {
    if (event.key !== "s" || !event.ctrlKey) return;
    event.preventDefault();
    savesRef.current += 1;
    setSaves(savesRef.current);
    onSavedRef.current?.(savesRef.current);
  });

  const onMount = useEffectEvent(() => {
    document.addEventListener("keydown", onShortcut);
  });
  useEffect(() => {
    onMount();
  }, []);

  const onUnmount = useEffectEvent(() => {
    document.removeEventListener("keydown", onShortcut);
  });
  useEffect(() => () => onUnmount(), []);

  return (
    <section
      className={cx("draft-editor", className)}
      aria-label="Draft"
      style={style}
      {...attributes}
    >
      <label>
        Draft
        <textarea name="draft" />
      </label>
      <p role="status">Saved: {saves}</p>
    </section>
  );
}
