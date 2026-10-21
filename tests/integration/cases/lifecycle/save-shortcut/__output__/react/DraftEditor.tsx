import {
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface DraftEditorEvents {
  onSaved?: (count: number) => void;
}

export interface DraftEditorAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
    >
      <label>
        Draft
        <textarea name="draft" />
      </label>
      <p role="status">Saved: {saves}</p>
    </section>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
