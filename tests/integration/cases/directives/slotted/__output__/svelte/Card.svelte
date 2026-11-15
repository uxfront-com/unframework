<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Disclosure from "./Disclosure.svelte";
  import { untrack } from "svelte";
  import type { Attachment } from "svelte/attachments";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }

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

<section class={["card", className]} aria-label="Card" {style} {...scopeAttributes(attributes)}>
  <Disclosure>
    <p data-name="body" {@attach vTrace(() => "body")}>Body</p>
  </Disclosure>
</section>
