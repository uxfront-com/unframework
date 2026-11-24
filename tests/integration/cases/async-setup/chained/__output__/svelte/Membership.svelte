<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { loadTeam, loadUser } from "./api";
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["p"], "id" | "children" | "class" | "style" | "ref"> & {
    id: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["p"] | null;
  };

  let { id, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  const user = await untrack(() => loadUser(id));
  const team = await loadTeam(user.teamId);
  const summary = $derived(`${user.name} is in ${team.name}`);
</script>

<p
  class={["membership", className]}
  role="status"
  {style}
  bind:this={ref}
  {...attributes}
>{summary}</p>
