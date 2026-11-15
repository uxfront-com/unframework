<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { vSelectable } from "./vSelectable.svelte";
  import { untrack } from "svelte";
  import type { Attachment } from "svelte/attachments";
  import type { ClassValue } from "svelte/elements";

  interface User {
    name: string;
  }

  const hooks = "data-hooks";
  const element = "data-element";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let user = $state.raw<User | null>({ name: "Ada" });
  let note = $state("Hello");

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }

  function vMark(getValue: () => string): Attachment<HTMLElement> {
    const hooks_1 = {
      mounted(el: HTMLElement, value: string) {
        el.setAttribute(hooks, value);
        el.setAttribute(element, "mounted");
        return el;
      },
      updated(el: HTMLElement, value: string) {
        const oldValue = "updated";
        el.setAttribute(hooks, `${oldValue} ${value}`);
      },
      unmounted() {},
    };
    return (element_1) => {
      let current = untrack(getValue);
      untrack(() => hooks_1.mounted(element_1, current));
      $effect(() => {
        const next = getValue();
        if (Object.is(next, current)) return;
        current = next;
        untrack(() => hooks_1.updated(element_1, next));
      });
      return () => hooks_1.unmounted();
    };
  }
</script>

<section
  class={["profile", className]}
  aria-label="Profile"
  {style}
  {...scopeAttributes(attributes)}
>
  {#if user}
    <p {@attach vMark(() => user!.name)}>{user.name}</p>
  {/if}<textarea
    aria-label="Note"
    bind:value={note}
    {@attach vMark(() => note)}
    {@attach vSelectable(() => true)}
  ></textarea
  ><button type="button" onclick={() => (user = user ? null : { name: "Grace" })}>Toggle</button>
</section>
