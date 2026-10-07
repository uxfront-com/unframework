import { ref } from "unframework";

export interface Profile {
  name: string;
  title: string;
  available: boolean;
}

export interface ProfileCardProps {
  initial: Profile;
}

export default function ProfileCard({ initial }: ProfileCardProps) {
  const profile = ref(initial);

  function rename(name: string) {
    profile.value = { ...profile.value, name };
  }

  function toggleAvailability() {
    profile.value = { ...profile.value, available: !profile.value.available };
  }

  return (
    <article class="profile-card" aria-label="Profile">
      <h2>{profile.value.name}</h2>
      <p>{profile.value.title}</p>
      <p role="status">{profile.value.available ? "Available" : "Away"}</p>
      <button type="button" onClick={() => rename("Ada King")}>
        Use married name
      </button>
      <button type="button" aria-pressed={profile.value.available} onClick={toggleAvailability}>
        Available
      </button>
    </article>
  );
}
