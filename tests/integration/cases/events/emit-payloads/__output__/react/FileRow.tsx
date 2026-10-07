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

export default function FileRow({
  path,
  size,
  onRefresh,
  onOpen,
  onMove,
  onPick,
  onShare,
}: FileRowProps & FileRowEvents) {
  function archive() {
    onMove?.(path, `archive/${path}`);
    onRefresh?.();
  }

  return (
    <div className="file-row" role="group" aria-label={path}>
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
