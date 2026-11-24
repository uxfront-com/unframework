<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Note from "./Note.svelte";
  import { untrack } from "svelte";
  import type { Attachment } from "svelte/attachments";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  const TRACE = "directive-trace";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let shown = $state(true);

  function vTrace(getValue: () => string): Attachment<HTMLElement> {
    const hooks = {
      mounted(el: HTMLElement, value: string) {
        document.dispatchEvent(
          new CustomEvent(TRACE, { detail: { call: `mounted ${value}`, el } }),
        );
      },
      unmounted(el: HTMLElement) {
        const call = `unmounted ${el.getAttribute("data-name")}`;
        document.dispatchEvent(new CustomEvent(TRACE, { detail: { call, el } }));
      },
    };
    return (element) => {
      untrack(() => hooks.mounted(element, untrack(getValue)));
      return () => hooks.unmounted(element);
    };
  }
</script>

<section
  class={["tree", className]}
  aria-label="Tree"
  data-name="outer"
  {@attach vTrace(() => "outer")}
  {style}
  bind:this={ref}
  {...attributes}
>
  <p data-name="first" {@attach vTrace(() => "first")}>First</p
  ><Note
  />{#if shown}
    <div class="branch" data-name="branch" {@attach vTrace(() => "branch")}>
      <span data-name="leaf" {@attach vTrace(() => "leaf")}>Leaf</span>
    </div>
  {:else}
    <p data-name="placeholder" {@attach vTrace(() => "placeholder")}>Placeholder</p>
  {/if}<p data-name="last" {@attach vTrace(() => "last")}>Last</p
  ><button type="button" onclick={() => (shown = !shown)}>Toggle</button>
</section>
