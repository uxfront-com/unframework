import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit, untrack } from "solid-js";

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

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
