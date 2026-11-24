<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Base from "./Base.svelte";
  import Primary from "./Primary.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let linked = $state(true);
  let log = $state.raw<string[]>([]);
  let direct = $state<HTMLAnchorElement | HTMLButtonElement | null>(null);
  let chained = $state<HTMLAnchorElement | HTMLButtonElement | null>(null);

  function record(line: string) {
    log = [...log, line];
  }
</script>

<section aria-label="Page" class={className} {style} bind:this={ref} {...attributes}>
  <Base
    href={linked ? "#direct" : undefined}
    text="Direct"
    id="direct"
    aria-label="Direct"
    data-testid="direct"
    title="Go"
    onclick={(event) => record(`click on ${(event.currentTarget as Element).localName}`)}
    onkeydown={(event) => record(`keydown ${event.key} on ${(event.currentTarget as Element).localName}`)}
    bind:ref={direct}
  /><Primary
    href={linked ? "#chained" : undefined}
    text="Chained"
    id="chained"
    aria-label="Chained"
    data-testid="chained"
    onclick={(event) => record(`chained on ${(event.currentTarget as Element).localName}`)}
    bind:ref={chained}
  /><button type="button" onclick={() => (linked = !linked)}>Toggle</button
  ><button type="button" onclick={() => direct?.focus()}>Focus direct</button
  ><button type="button" onclick={() => chained?.focus()}>Focus chained</button
  ><ol aria-label="Log">
    {#each log as entry, index (index)}
      <li>{entry}</li>
    {/each}
  </ol>
</section>
