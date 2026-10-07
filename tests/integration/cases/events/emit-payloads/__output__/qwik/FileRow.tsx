import { $, type QRL, component$ } from "@qwik.dev/core";

export interface FileInfo {
  path: string;
  size: number;
}

export interface FileRowProps {
  path: string;
  size: number;
}

export interface FileRowEvents {
  onRefresh$?: QRL<() => void>;
  onOpen$?: QRL<(path: string) => void>;
  onMove$?: QRL<(from: string, to: string) => void>;
  onPick$?: QRL<(file: FileInfo) => void>;
  onShare$?: QRL<(path: string, note?: string) => void>;
}

export default component$<FileRowProps & FileRowEvents>(
  ({ path, size, onRefresh$, onOpen$, onMove$, onPick$, onShare$ }) => {
    const archive = $(() => {
      onMove$?.(path, `archive/${path}`);
      onRefresh$?.();
    });

    return (
      <div class="file-row" role="group" aria-label={path}>
        <span>
          {path} ({size} bytes)
        </span>
        <button type="button" onClick$={() => onRefresh$?.()}>
          Refresh
        </button>
        <button type="button" onClick$={() => onOpen$?.(path)}>
          Open
        </button>
        <button type="button" onClick$={archive}>
          Archive
        </button>
        <button type="button" onClick$={() => onPick$?.({ path, size })}>
          Select
        </button>
        <button type="button" onClick$={() => onShare$?.(path)}>
          Share
        </button>
        <button type="button" onClick$={() => onShare$?.(path, "Please review")}>
          Share with a note
        </button>
      </div>
    );
  },
);
