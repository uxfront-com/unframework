import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit, untrack } from "solid-js";

export interface Profile {
  name: string;
  title: string;
  available: boolean;
}

export interface ProfileCardProps {
  initial: Profile;
}

export default function ProfileCard(
  props: ProfileCardProps &
    Omit<ComponentProps<"article">, "initial" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "initial", "class");

  const [profile, setProfile] = createState(untrack(() => props.initial));

  function rename(name: string) {
    setProfile({ ...profile(), name });
  }

  function toggleAvailability() {
    setProfile({ ...profile(), available: !profile().available });
  }

  return (
    <article
      class={props.class ? `profile-card ${props.class}` : "profile-card"}
      aria-label="Profile"
      {...others}
    >
      <h2>{profile().name}</h2>
      <p>{profile().title}</p>
      <p role="status">{profile().available ? "Available" : "Away"}</p>
      <button type="button" onClick={() => rename("Ada King")}>
        Use married name
      </button>
      <button
        type="button"
        aria-pressed={enumeratedValue(profile().available)}
        onClick={toggleAvailability}
      >
        Available
      </button>
    </article>
  );
}
