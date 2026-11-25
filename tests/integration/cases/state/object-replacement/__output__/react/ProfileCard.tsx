import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export interface Profile {
  name: string;
  title: string;
  available: boolean;
}

export interface ProfileCardProps {
  initial: Profile;
}

export type ProfileCardAttributes = Omit<ComponentPropsWithRef<"article">, "initial" | "children">;

export default function ProfileCard({
  initial,
  className,
  style,
  ...attributes
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
    <article
      className={cx("profile-card", className)}
      aria-label="Profile"
      style={style}
      {...attributes}
    >
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
