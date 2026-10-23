import { $, type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export interface Profile {
  name: string;
  title: string;
  available: boolean;
}

export interface ProfileCardProps {
  initial: Profile;
}

export default component$<ProfileCardProps & { class?: ClassList; style?: CSSProperties }>(
  ({ initial, class: className, style, ...attributes }) => {
    const profile = useSignal(initial);

    const rename = $((name: string) => {
      profile.value = { ...profile.value, name };
    });

    const toggleAvailability = $(() => {
      profile.value = { ...profile.value, available: !profile.value.available };
    });

    return (
      <article
        class={["profile-card", className]}
        aria-label="Profile"
        {...scopeAttributes(attributes)}
        style={style}
      >
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
