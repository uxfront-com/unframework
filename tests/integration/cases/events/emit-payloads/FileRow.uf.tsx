import { defineEmits } from "unframework";

export interface FileInfo {
  path: string;
  size: number;
}

export interface FileRowProps {
  path: string;
  size: number;
}

export default function FileRow({ path, size }: FileRowProps) {
  const emit = defineEmits<{
    refresh: [];
    open: [path: string];
    move: [from: string, to: string];
    pick: [file: FileInfo];
    share: [path: string, note?: string];
  }>();

  function archive() {
    emit("move", path, `archive/${path}`);
    emit("refresh");
  }

  return (
    <div class="file-row" role="group" aria-label={path}>
      <span>
        {path} ({size} bytes)
      </span>
      <button type="button" onClick={() => emit("refresh")}>
        Refresh
      </button>
      <button type="button" onClick={() => emit("open", path)}>
        Open
      </button>
      <button type="button" onClick={archive}>
        Archive
      </button>
      <button type="button" onClick={() => emit("pick", { path, size })}>
        Select
      </button>
      <button type="button" onClick={() => emit("share", path)}>
        Share
      </button>
      <button type="button" onClick={() => emit("share", path, "Please review")}>
        Share with a note
      </button>
    </div>
  );
}
