import { useRef, useState } from "react";

export interface Profile {
  name: string;
  title: string;
  available: boolean;
}

export interface ProfileCardProps {
  initial: Profile;
}

export default function ProfileCard({ initial }: ProfileCardProps) {
  const [profile, setProfile] = useState(initial);
  const profileRef = useRef(profile);

  function rename(name: string) {
    profileRef.current = { ...profileRef.current, name };
    setProfile(profileRef.current);
  }

  function toggleAvailability() {
    profileRef.current = { ...profileRef.current, available: !profileRef.current.available };
    setProfile(profileRef.current);
  }

  return (
    <article className="profile-card" aria-label="Profile">
      <h2>{profile.name}</h2>
      <p>{profile.title}</p>
      <p role="status">{profile.available ? "Available" : "Away"}</p>
      <button type="button" onClick={() => rename("Ada King")}>
        Use married name
      </button>
      <button type="button" aria-pressed={profile.available} onClick={toggleAvailability}>
        Available
      </button>
    </article>
  );
}
