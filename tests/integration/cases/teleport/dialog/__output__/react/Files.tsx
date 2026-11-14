import ConfirmDialog from "./ConfirmDialog";
import {
  type CSSProperties,
  type ReactNode,
  type ReactPortal,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

export interface FilesProps {
  file: string;
}

export interface FilesEvents {
  onDelete?: (file: string) => void;
}

export interface FilesAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Files({
  file,
  onDelete,
  className,
  style,
  ...attributes
}: FilesProps & FilesEvents & FilesAttributes) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);

  function confirm() {
    openRef.current = false;
    setOpen(openRef.current);
    onDelete?.(file);
  }

  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  return (
    <section
      className={cx("files", className)}
      aria-label="Files"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p>{file}</p>
      <button
        type="button"
        onClick={() => {
          openRef.current = true;
          setOpen(openRef.current);
        }}
      >
        Delete {file}
      </button>
      {open
        ? mounted
          ? teleport(
              <div data-teleported="true" className="backdrop">
                <ConfirmDialog
                  title={`Delete ${file}?`}
                  onConfirm={confirm}
                  onClose={() => {
                    openRef.current = false;
                    setOpen(openRef.current);
                  }}
                />
              </div>,
              "body",
            )
          : null
        : null}
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

/** Subscribes to nothing: whether the component has mounted never changes once it has. */
function subscribeNothing(): () => void {
  return () => {};
}

/** Portals `children` into the element `to` selects, or renders nothing where none does. */
function teleport(children: ReactNode, to: string): ReactPortal | null {
  const target = document.querySelector(to);
  return target ? createPortal(children, target) : null;
}
