<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface Profile {
    name: string;
    title: string;
    available: boolean;
  }

  export interface ProfileCardProps {
    initial: Profile;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "initial" | "children" | "class" | "style" | "ref"
  > &
    ProfileCardProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["article"] | null;
    };

  let { initial, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let profile = $state.raw(untrack(() => initial));

  function rename(name: string) {
    profile = { ...profile, name };
  }

  function toggleAvailability() {
    profile = { ...profile, available: !profile.available };
  }
</script>

<article
  class={["profile-card", className]}
  aria-label="Profile"
  {style}
  bind:this={ref}
  {...attributes}
>
  <h2>{profile.name}</h2
  ><p>{profile.title}</p
  ><p role="status">{profile.available ? "Available" : "Away"}</p
  ><button type="button" onclick={() => rename("Ada King")}>Use married name</button
  ><button
    type="button"
    aria-pressed={profile.available}
    onclick={toggleAvailability}
  >Available</button>
</article>
