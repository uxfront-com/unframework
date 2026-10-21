import type { JSX } from "solid-js";

export default function ProfileCard(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <article
      class={props.class ? `profile ${props.class}` : "profile"}
      aria-labelledby="profile-name"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <header class="profile-header">
        <img
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%23345'/%3E%3C/svg%3E"
          alt="Ada's avatar"
          width="48"
          height="48"
        />
        <h2 id="profile-name">Ada Lovelace</h2>
      </header>
      <p>
        Mathematician &amp; writer
        <br />
        of the first published program
      </p>
      <hr />
      <label for="profile-note">Note</label>
      <input id="profile-note" type="text" name="note" placeholder="Say hello" />
    </article>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
