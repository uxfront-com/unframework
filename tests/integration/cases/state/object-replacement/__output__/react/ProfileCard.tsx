import { type CSSProperties, useRef, useState } from "react";

export interface Profile {
  name: string;
  title: string;
  available: boolean;
}

export interface ProfileCardProps {
  initial: Profile;
}

export interface ProfileCardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ProfileCard({
  initial,
  className,
  style,
}: ProfileCardProps & ProfileCardAttributes) {
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
    <article className={cx("profile-card", className)} aria-label="Profile" style={style}>
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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
