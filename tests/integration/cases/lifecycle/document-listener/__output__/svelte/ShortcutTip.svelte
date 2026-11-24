<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "ondismissed" | "onshortcut" | "children" | "class" | "style" | "ref"
  > & {
    ondismissed?: () => void;
    onshortcut?: (key: string, count: number) => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let {
    ondismissed,
    onshortcut,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

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
</script>

<section
  class={["shortcut-tip", className]}
  aria-label="Shortcuts"
  {style}
  bind:this={ref}
  {...attributes}
>
  <p>{open ? "Press Escape to hide this tip." : "Tip hidden."}</p
  ><button type="button" aria-pressed={enabled} onclick={toggle}>Shortcut K</button
  ><p role="status">Used: {count}</p>
</section>
