<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  export interface Profile {
    name: string;
    title: string;
    available: boolean;
  }

  export interface ProfileCardProps {
    initial: Profile;
  }

  type Props = ProfileCardProps & { class?: ClassValue; style?: string };

  let { initial, class: className, style, ...attributes }: Props = $props();

  let profile = $state.raw(untrack(() => initial));

  function rename(name: string) {
    profile = { ...profile, name };
  }

  function toggleAvailability() {
    profile = { ...profile, available: !profile.available };
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<article
  class={["profile-card", className]}
  aria-label="Profile"
  {style}
  {...scopeAttributes(attributes)}
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
