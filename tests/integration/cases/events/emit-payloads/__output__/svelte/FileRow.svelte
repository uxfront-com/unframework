<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface FileInfo {
    path: string;
    size: number;
  }

  export interface FileRowProps {
    path: string;
    size: number;
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = FileRowProps & {
    onrefresh?: () => void;
    onopen?: (path: string) => void;
    onmove?: (from: string, to: string) => void;
    onpick?: (file: FileInfo) => void;
    onshare?: (path: string, note?: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let {
    path,
    size,
    onrefresh,
    onopen,
    onmove,
    onpick,
    onshare,
    class: className,
    style,
    ...attributes
  }: Props = $props();

  function archive() {
    onmove?.(path, `archive/${path}`);
    onrefresh?.();
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div
  class={["file-row", className]}
  role="group"
  aria-label={path}
  {style}
  {...scopeAttributes(attributes)}
>
  <span>{path} ({size} bytes)</span
  ><button type="button" onclick={() => onrefresh?.()}>Refresh</button
  ><button type="button" onclick={() => onopen?.(path)}>Open</button
  ><button type="button" onclick={archive}>Archive</button
  ><button type="button" onclick={() => onpick?.({ path, size })}>Select</button
  ><button type="button" onclick={() => onshare?.(path)}>Share</button
  ><button type="button" onclick={() => onshare?.(path, "Please review")}>Share with a note</button>
</div>
