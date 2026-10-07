<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface FileInfo {
    path: string;
    size: number;
  }

  export interface FileRowProps {
    path: string;
    size: number;
  }

  type Props = FileRowProps & {
    onrefresh?: () => void;
    onopen?: (path: string) => void;
    onmove?: (from: string, to: string) => void;
    onpick?: (file: FileInfo) => void;
    onshare?: (path: string, note?: string) => void;
  };

  let { path, size, onrefresh, onopen, onmove, onpick, onshare }: Props = $props();

  function archive() {
    onmove?.(path, `archive/${path}`);
    onrefresh?.();
  }
</script>

<div class="file-row" role="group" aria-label={path}>
  <span>{path} ({size} bytes)</span
  ><button type="button" onclick={() => onrefresh?.()}>Refresh</button
  ><button type="button" onclick={() => onopen?.(path)}>Open</button
  ><button type="button" onclick={archive}>Archive</button
  ><button type="button" onclick={() => onpick?.({ path, size })}>Select</button
  ><button type="button" onclick={() => onshare?.(path)}>Share</button
  ><button type="button" onclick={() => onshare?.(path, "Please review")}>Share with a note</button>
</div>
