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
      {...scopeAttributes(props)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
