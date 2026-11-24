<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Disclosure from "./Disclosure.svelte";
  import { untrack } from "svelte";
  import type { Attachment } from "svelte/attachments";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let note = $state.raw<{ name: string } | null>({ name: "note" });

  function vTrace(getValue: () => string): Attachment<HTMLElement> {
    const hooks = {
      mounted(el: HTMLElement, value: string) {
        const call = `mounted ${value}`;
        document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
      },
      unmounted(el: HTMLElement) {
        const call = `unmounted ${el.getAttribute("data-name")}`;
        document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
      },
    };
    return (element) => {
      untrack(() => hooks.mounted(element, untrack(getValue)));
      return () => hooks.unmounted(element);
    };
  }
</script>

<section class={["card", className]} aria-label="Card" {style} bind:this={ref} {...attributes}>
  <Disclosure>
    <p data-name="body" {@attach vTrace(() => "body")}>Body</p
    >{#if note}{@const traceValue = note.name}<p
      data-name="note"
      {@attach vTrace(() => traceValue)}
    >Note</p>{/if}
  </Disclosure
  ><button type="button" onclick={() => (note = { name: "renamed" })}>Rename</button>
</section>
