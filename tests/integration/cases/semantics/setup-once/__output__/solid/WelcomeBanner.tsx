import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, splitProps, untrack } from "solid-js";

export interface WelcomeBannerProps {
  name: string;
}

const tips = ["Set up your profile", "Invite your team"];

export default function WelcomeBanner(
  props: WelcomeBannerProps &
    Omit<ComponentProps<"section">, "name" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["name", "class"]);

  const greeting = untrack(() => `Welcome, ${props.name}`);

  return (
    <section
      class={props.class ? `welcome-banner ${props.class}` : "welcome-banner"}
      aria-label="Welcome"
      {...others}
    >
      <h2>{greeting}</h2>
      <p>Signed in as {props.name}</p>
      <ul>
        <KeyedFor each={tips} by={(tip) => tip}>
          {(tip) => <li>{tip.value}</li>}
        </KeyedFor>
      </ul>
    </section>
  );
}
