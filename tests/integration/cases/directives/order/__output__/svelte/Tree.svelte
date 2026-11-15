<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";
  import type { Attachment } from "svelte/attachments";
  import type { ClassValue } from "svelte/elements";

  const TRACE = "directive-trace";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let shown = $state(true);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }

  function vTrace(getValue: () => string): Attachment<HTMLElement> {
    const hooks = {
      mounted(el: HTMLElement, value: string): void {
        document.dispatchEvent(
          new CustomEvent(TRACE, { detail: { call: `mounted ${value}`, el } }),
        );
      },
      unmounted(el: HTMLElement): void {
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
  {...scopeAttributes(attributes)}
>
  <p data-name="first" {@attach vTrace(() => "first")}>First</p
  >{#if shown}
    <div class="branch" data-name="branch" {@attach vTrace(() => "branch")}>
      <span data-name="leaf" {@attach vTrace(() => "leaf")}>Leaf</span>
    </div>
  {/if}<p data-name="last" {@attach vTrace(() => "last")}>Last</p
  ><button type="button" onclick={() => (shown = !shown)}>Toggle</button>
</section>
