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
    >
      <h2>{greeting}</h2>
      <p>Signed in as {props.name}</p>
      <ul>
        <For each={tips}>{(tip) => <li>{tip}</li>}</For>
      </ul>
    </section>
  );
}
