<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface CommandMenuProps {
    commands: string[];
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "commands" | "onrun" | "ondismiss" | "children" | "class" | "style" | "ref"
  > &
    CommandMenuProps & {
      onrun?: (command: string) => void;
      ondismiss?: () => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    commands,
    onrun,
    ondismiss,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let active = $state(0);
  let query = $state("");
  let shortcutField: HTMLInputElement | null = null;

  function handleKey(event: KeyboardEvent) {
    if (event.key === "Enter") event.preventDefault();
    if (event.key === "ArrowDown") {
      active = (active + 1) % commands.length;
    } else if (event.key === "ArrowUp") {
      active = (active + commands.length - 1) % commands.length;
    } else if (event.key === "Enter") {
      onrun?.(commands[active] ?? query);
    } else if (event.key === "Escape") {
      active = 0;
      ondismiss?.();
    }
  }

  function clearShortcut() {
    const input = shortcutField;
    if (input) input.value = "";
  }
</script>

<section
  class={["command-menu", className]}
  aria-label="Command menu"
  {style}
  bind:this={ref}
  {...attributes}
>
  <form role="search" aria-label="Commands">
    <label>Command<input
      name="command"
      oninput={(event) => (query = (event.currentTarget as HTMLInputElement).value)}
      onkeydown={handleKey}
    /></label>
  </form
  ><ul aria-label="Suggestions">
    {#each commands as command, index (command)}
      <li aria-current={index === active ? "true" : undefined}>{command}</li>
    {/each}
  </ul
  ><label>Shortcut name<input
    name="shortcut"
    bind:this={shortcutField}
    onkeydown={(event) => event.key === "Escape" && clearShortcut()}
  /></label>
</section>
