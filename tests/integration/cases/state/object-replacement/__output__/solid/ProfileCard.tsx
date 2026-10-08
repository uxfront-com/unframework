import { createSignal, untrack } from "solid-js";

export interface Profile {
  name: string;
  title: string;
  available: boolean;
}

export interface ProfileCardProps {
  initial: Profile;
}

export default function ProfileCard(props: ProfileCardProps) {
  const [profile, setProfile] = createSignal(untrack(() => props.initial));

  function rename(name: string) {
    setProfile({ ...profile(), name });
  }

  function toggleAvailability() {
    setProfile({ ...profile(), available: !profile().available });
  }

  return (
    <article class="profile-card" aria-label="Profile">
      <h2>{profile().name}</h2>
      <p>{profile().title}</p>
      <p role="status">{profile().available ? "Available" : "Away"}</p>
      <button type="button" onClick={() => rename("Ada King")}>
        Use married name
      </button>
      <button type="button" aria-pressed={profile().available} onClick={toggleAvailability}>
        Available
      </button>
    </article>
  );
}
