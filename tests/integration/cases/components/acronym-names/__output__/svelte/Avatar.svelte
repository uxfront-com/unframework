<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLButtonAttributes,
    "imageURL" | "userID" | "onpickedurl" | "children" | "class" | "style" | "ref"
  > & {
    imageURL: string;
    userID: number;
    onpickedurl?: (url: string) => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["button"] | null;
  };

  let {
    imageURL,
    userID,
    onpickedurl,
    class: className,
    style,
    ref = $bindable(null),
    onclick,
    ...attributes
  }: Props = $props();
</script>

<button
  type="button"
  data-user={userID}
  onclick={(event) => {
    onpickedurl?.(imageURL);
    onclick?.(event);
  }}
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
>User {userID}: {imageURL}</button>
