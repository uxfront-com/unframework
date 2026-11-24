<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface WelcomeBannerProps {
    name: string;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "name" | "children" | "class" | "style" | "ref"
  > &
    WelcomeBannerProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let { name, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  const greeting = untrack(() => `Welcome, ${name}`);
  const tips = ["Set up your profile", "Invite your team"];
</script>

<section
  class={["welcome-banner", className]}
  aria-label="Welcome"
  {style}
  bind:this={ref}
  {...attributes}
>
  <h2>{greeting}</h2
  ><p>Signed in as {name}</p
  ><ul>
    {#each tips as tip (tip)}
      <li>{tip}</li>
    {/each}
  </ul>
</section>
