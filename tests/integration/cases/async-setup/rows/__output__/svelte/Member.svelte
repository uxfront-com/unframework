<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { loadUser } from "./api";
  import { untrack } from "svelte";
  import type { ClassValue, HTMLLiAttributes } from "svelte/elements";

  type Props = Omit<HTMLLiAttributes, "id" | "children" | "class" | "style" | "ref"> & {
    id: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["li"] | null;
  };

  let { id, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  const user = await untrack(() => loadUser(id));
</script>

<li class={["member", className]} {style} bind:this={ref} {...attributes}>{user.name}</li>
