<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface WelcomeBannerProps {
    name: string;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = WelcomeBannerProps & { class?: ClassValue; style?: string };

  let { name, class: className, style, ...attributes }: Props = $props();

  const greeting = untrack(() => `Welcome, ${name}`);
  const tips = ["Set up your profile", "Invite your team"];

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["welcome-banner", className]}
  aria-label="Welcome"
  {style}
  {...scopeAttributes(attributes)}
>
  <h2>{greeting}</h2
  ><p>Signed in as {name}</p
  ><ul>
    {#each tips as tip (tip)}
      <li>{tip}</li>
    {/each}
  </ul>
</section>
