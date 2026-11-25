import ConfirmDialog from "./ConfirmDialog";
import { cx } from "./_unframework/cx";
import { subscribeNothing } from "./_unframework/subscribeNothing";
import { teleport } from "./_unframework/teleport";
import { type ComponentPropsWithRef, useRef, useState, useSyncExternalStore } from "react";

export interface FilesProps {
  file: string;
}

export interface FilesEvents {
  onDelete?: (file: string) => void;
}

export type FilesAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "file" | "onDelete" | "children"
>;

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
    <section className={cx("files", className)} aria-label="Files" style={style} {...attributes}>
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
