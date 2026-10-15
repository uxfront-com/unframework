import type { JSX } from "solid-js";

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

export default function FileRow(
  props: FileRowProps & FileRowEvents & { class?: string; style?: JSX.CSSProperties },
) {
  function archive() {
    props.onMove?.(props.path, `archive/${props.path}`);
    props.onRefresh?.();
  }

  return (
    <div
      class={props.class ? `file-row ${props.class}` : "file-row"}
      role="group"
      aria-label={props.path}
      style={props.style}
    >
      <span>
        {props.path} ({props.size} bytes)
      </span>
      <button type="button" onClick={() => props.onRefresh?.()}>
        Refresh
      </button>
      <button type="button" onClick={() => props.onOpen?.(props.path)}>
        Open
      </button>
      <button type="button" onClick={archive}>
        Archive
      </button>
      <button type="button" onClick={() => props.onPick?.({ path: props.path, size: props.size })}>
        Select
      </button>
      <button type="button" onClick={() => props.onShare?.(props.path)}>
        Share
      </button>
      <button type="button" onClick={() => props.onShare?.(props.path, "Please review")}>
        Share with a note
      </button>
    </div>
  );
}
