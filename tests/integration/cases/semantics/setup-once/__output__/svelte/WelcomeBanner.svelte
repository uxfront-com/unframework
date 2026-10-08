<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";

  export interface WelcomeBannerProps {
    name: string;
  }

  let { name }: WelcomeBannerProps = $props();

  const greeting = untrack(() => `Welcome, ${name}`);
  const tips = ["Set up your profile", "Invite your team"];
</script>

<section class="welcome-banner" aria-label="Welcome">
  <h2>{greeting}</h2
  ><p>Signed in as {name}</p
  ><ul>
    {#each tips as tip (tip)}
      <li>{tip}</li>
    {/each}
  </ul>
</section>
