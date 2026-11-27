import Emphasis from "./Emphasis";
import FadeAction from "./FadeAction";
import Greeting from "./Greeting";
import IconAction from "./IconAction";
import LabelAction from "./LabelAction";
import SwitchAction from "./SwitchAction";
import TipAction from "./TipAction";
import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";

const ada = { name: "Ada" };

const grace = { name: "Grace" };

export default function Page(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [linked, setLinked] = createSignal(true);
  const [strong, setStrong] = createSignal(true);
  const [signedIn, setSignedIn] = createSignal(true);
  const [tips, setTips] = createSignal(false);

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
      <Greeting user={signedIn() ? grace : undefined} />
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
