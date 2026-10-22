<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    ondismissed?: () => void;
    onshortcut?: (key: string, count: number) => void;
    class?: ClassValue;
    style?: string;
  };

  let { ondismissed, onshortcut, class: className, style, ...attributes }: Props = $props();

  let open = $state(true);
  let enabled = $state(false);
  let count = $state(0);

  function onEscape(event: KeyboardEvent) {
    if (event.key === "Escape") {
      open = false;
      ondismissed?.();
    }
  }

  function onShortcut(event: KeyboardEvent) {
    if (event.key === "k") {
      count += 1;
      onshortcut?.(event.key, count);
    }
  }

  function toggle() {
    enabled = !enabled;
  }

  let previousEnabled = untrack(() => enabled);
  $effect(() => {
    const on = enabled;
    if (Object.is(on, previousEnabled)) return;
    previousEnabled = on;
    untrack(() => {
      if (on) {
        document.addEventListener("keydown", onShortcut);
      } else {
        document.removeEventListener("keydown", onShortcut);
      }
    });
  });

  onMount(() => {
    document.addEventListener("keydown", onEscape);
  });

  onMount(() => () => {
    document.removeEventListener("keydown", onEscape);
    document.removeEventListener("keydown", onShortcut);
  });

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["shortcut-tip", className]}
  aria-label="Shortcuts"
  {style}
  {...scopeAttributes(attributes)}
>
  <p>{open ? "Press Escape to hide this tip." : "Tip hidden."}</p
  ><button type="button" aria-pressed={enabled} onclick={toggle}>Shortcut K</button
  ><p role="status">Used: {count}</p>
</section>
