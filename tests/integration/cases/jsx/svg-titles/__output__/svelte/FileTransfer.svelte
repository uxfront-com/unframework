<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface FileTransferProps {
    fileName: string;
    percent: number;
    paused: boolean;
    eta?: string;
  }

  type Props = FileTransferProps & { class?: ClassValue; style?: string };

  let { fileName, percent, paused, eta, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["file-transfer", className]} {style} {...scopeAttributes(attributes)}>
  <svg class="file-transfer-progress" role="img" viewBox="0 0 36 36" width="36" height="36">
    <title>{fileName}: {percent}% sent. {eta}</title
    ><circle cx="18" cy="18" r="16" fill="none" stroke="#0969da" stroke-width="4" />
  </svg
  ><svg class="file-transfer-state" role="img" viewBox="0 0 16 16" width="16" height="16">
    <title>{#if paused}Transfer paused{:else}Sending {fileName}{/if}</title
    ><rect x="2" y="2" width="12" height="12" rx="2" fill="#1a7f37" />
  </svg>
</div>
