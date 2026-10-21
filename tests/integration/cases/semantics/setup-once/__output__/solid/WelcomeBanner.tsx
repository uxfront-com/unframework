import { For, type JSX, untrack } from "solid-js";

export interface WelcomeBannerProps {
  name: string;
}

const tips = ["Set up your profile", "Invite your team"];

export default function WelcomeBanner(
  props: WelcomeBannerProps & { class?: string; style?: JSX.CSSProperties },
) {
  const greeting = untrack(() => `Welcome, ${props.name}`);

  return (
    <section
      class={props.class ? `welcome-banner ${props.class}` : "welcome-banner"}
      aria-label="Welcome"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2>{greeting}</h2>
      <p>Signed in as {props.name}</p>
      <ul>
        <For each={tips}>{(tip) => <li>{tip}</li>}</For>
      </ul>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
