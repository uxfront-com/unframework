<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import EachAction from "./EachAction.svelte";
  import FadeFace from "./FadeFace.svelte";
  import FramedNote from "./FramedNote.svelte";
  import OnceAction from "./OnceAction.svelte";
  import RowList from "./RowList.svelte";
  import TagList from "./TagList.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let bold = $state(true);
</script>

<section class={["shelf", className]} {style} bind:this={ref} {...attributes}>
  <RowList label="Produce" items={["Apples", "Pears", "Plums"]}>
    <em>fresh</em>
  </RowList
  ><FramedNote title="Release notes">
    <strong>Draft</strong>
  </FramedNote
  ><TagList ordered={true} label="Ranked" items={["gold", "silver"]}>
    <span>Medal</span>
  </TagList
  ><TagList ordered={false} label="Unranked" items={["red", "blue"]}>
    <span>Colour</span>
  </TagList
  ><OnceAction href="#once" label="Once">Open once</OnceAction
  ><OnceAction label="Single">Press once</OnceAction
  ><EachAction href="#each" items={["one", "two"]}>Open each</EachAction
  ><EachAction items={["three", "four"]}>Press each</EachAction><FadeFace {bold}>Face</FadeFace
  ><button type="button" onclick={() => (bold = !bold)}>Swap face</button>
</section>
