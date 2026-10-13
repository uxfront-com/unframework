import type { CSSProperties } from "react";

export interface FileInfo {
  path: string;
  size: number;
}

export interface FileRowProps {
  path: string;
  size: number;
}

export interface FileRowEvents {
  onRefresh?: () => void;
  onOpen?: (path: string) => void;
  onMove?: (from: string, to: string) => void;
  onPick?: (file: FileInfo) => void;
  onShare?: (path: string, note?: string) => void;
}

export interface FileRowAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function FileRow({
  path,
  size,
  onRefresh,
  onOpen,
  onMove,
  onPick,
  onShare,
  className,
  style,
}: FileRowProps & FileRowEvents & FileRowAttributes) {
  function archive() {
    onMove?.(path, `archive/${path}`);
    onRefresh?.();
  }

  return (
    <div className={cx("file-row", className)} role="group" aria-label={path} style={style}>
      <span>
        {path} ({size} bytes)
      </span>
      <button type="button" onClick={() => onRefresh?.()}>
        Refresh
      </button>
      <button type="button" onClick={() => onOpen?.(path)}>
        Open
      </button>
      <button type="button" onClick={archive}>
        Archive
      </button>
      <button type="button" onClick={() => onPick?.({ path, size })}>
        Select
      </button>
      <button type="button" onClick={() => onShare?.(path)}>
        Share
      </button>
      <button type="button" onClick={() => onShare?.(path, "Please review")}>
        Share with a note
      </button>
    </div>
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
