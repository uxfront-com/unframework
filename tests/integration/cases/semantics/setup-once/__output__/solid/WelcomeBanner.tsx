import { For, untrack } from "solid-js";

export interface WelcomeBannerProps {
  name: string;
}

const tips = ["Set up your profile", "Invite your team"];

export default function WelcomeBanner(props: WelcomeBannerProps) {
  const greeting = untrack(() => `Welcome, ${props.name}`);

  return (
    <section class="welcome-banner" aria-label="Welcome">
      <h2>{greeting}</h2>
      <p>Signed in as {props.name}</p>
      <ul>
        <For each={tips}>{(tip) => <li>{tip}</li>}</For>
      </ul>
    </section>
  );
}
