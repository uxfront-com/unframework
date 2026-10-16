<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = {
    imageURL: string;
    userID: number;
    onpickedurl?: (url: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let { imageURL, userID, onpickedurl, class: className, style }: Props = $props();
</script>

<button
  type="button"
  data-user={userID}
  onclick={() => onpickedurl?.(imageURL)}
  class={className}
  {style}
>User {userID}: {imageURL}</button>
