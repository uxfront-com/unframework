<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";

  export interface Profile {
    name: string;
    title: string;
    available: boolean;
  }

  export interface ProfileCardProps {
    initial: Profile;
  }

  let { initial }: ProfileCardProps = $props();

  let profile = $state.raw(untrack(() => initial));

  function rename(name: string) {
    profile = { ...profile, name };
  }

  function toggleAvailability() {
    profile = { ...profile, available: !profile.available };
  }
</script>

<article class="profile-card" aria-label="Profile">
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
