import { $, component$, useSignal } from "@qwik.dev/core";

export interface Profile {
  name: string;
  title: string;
  available: boolean;
}

export interface ProfileCardProps {
  initial: Profile;
}

export default component$<ProfileCardProps>(({ initial }) => {
  const profile = useSignal(initial);

  const rename = $((name: string) => {
    profile.value = { ...profile.value, name };
  });

  const toggleAvailability = $(() => {
    profile.value = { ...profile.value, available: !profile.value.available };
  });

  return (
    <article class="profile-card" aria-label="Profile">
      <h2>{profile.value.name}</h2>
      <p>{profile.value.title}</p>
      <p role="status">{profile.value.available ? "Available" : "Away"}</p>
      <button type="button" onClick$={() => rename("Ada King")}>
        Use married name
      </button>
      <button type="button" aria-pressed={profile.value.available} onClick$={toggleAvailability}>
        Available
      </button>
    </article>
  );
});
