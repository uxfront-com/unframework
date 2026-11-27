import Emphasis from "./Emphasis";
import FadeAction from "./FadeAction";
import Greeting from "./Greeting";
import IconAction from "./IconAction";
import LabelAction from "./LabelAction";
import SwitchAction from "./SwitchAction";
import TipAction from "./TipAction";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

const ada = { name: "Ada" };

const grace = { name: "Grace" };

export default function Page(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [linked, setLinked] = createState(true);
  const [strong, setStrong] = createState(true);
  const [signedIn, setSignedIn] = createState(true);
  const [tips, setTips] = createState(false);

  return (
    <section class={props.class ? `page ${props.class}` : "page"} {...others}>
      <LabelAction href="#docs" label="Docs">
        Read the docs
      </LabelAction>
      <LabelAction label="Save">Save the draft</LabelAction>
      <LabelAction href="#home" label="Home" />
      <LabelAction label="Close" />
      <FadeAction href="#guide" label="Guide">
        Read the guide
      </FadeAction>
      <FadeAction label="Send">Send the draft</FadeAction>
      <FadeAction href="#blog" label="Blog" />
      <FadeAction label="Undo" />
      <IconAction href="#faq" label="FAQ">
        Read the FAQ
      </IconAction>
      <IconAction label="Print">Print the draft</IconAction>
      <IconAction href="#news" label="News" />
      <IconAction label="Reset" />
      <SwitchAction href={linked() ? "#more" : undefined}>Learn more</SwitchAction>
      <Emphasis strong={strong()}>Mind the gap</Emphasis>
      <Greeting user={signedIn() ? ada : undefined}>Welcome back</Greeting>
      <Greeting user={grace} />
      <Greeting />
      <Show when={tips()}>
        <div class="tips">
          <TipAction href="#tips" label="Tips">
            Linked tip
          </TipAction>
          <TipAction label="Help">Button tip</TipAction>
          <TipAction href="#about" label="About" />
          <TipAction label="Hint" />
        </div>
      </Show>
      <button type="button" onClick={() => setLinked(!linked())}>
        Toggle link
      </button>
      <button type="button" onClick={() => setStrong(!strong())}>
        Toggle emphasis
      </button>
      <button type="button" onClick={() => setSignedIn(!signedIn())}>
        Toggle user
      </button>
      <button type="button" onClick={() => setTips(true)}>
        Show tips
      </button>
    </section>
  );
}
