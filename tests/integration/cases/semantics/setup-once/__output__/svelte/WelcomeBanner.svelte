<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  export interface WelcomeBannerProps {
    name: string;
  }

  type Props = WelcomeBannerProps & { class?: ClassValue; style?: string };

  let { name, class: className, style }: Props = $props();

  const greeting = untrack(() => `Welcome, ${name}`);
  const tips = ["Set up your profile", "Invite your team"];
</script>

<section class={["welcome-banner", className]} aria-label="Welcome" {style}>
  <h2>{greeting}</h2
  ><p>Signed in as {name}</p
  ><ul>
    {#each tips as tip (tip)}
      <li>{tip}</li>
    {/each}
  </ul>
</section>
