<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface CommandMenuProps {
    commands: string[];
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = CommandMenuProps & {
    onrun?: (command: string) => void;
    ondismiss?: () => void;
    class?: ClassValue;
    style?: string;
  };

  let { commands, onrun, ondismiss, class: className, style, ...attributes }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["command-menu", className]}
  aria-label="Command menu"
  {style}
  {...scopeAttributes(attributes)}
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
