import Emphasis from "./Emphasis";
import FadeAction from "./FadeAction";
import Greeting from "./Greeting";
import IconAction from "./IconAction";
import LabelAction from "./LabelAction";
import SwitchAction from "./SwitchAction";
import TipAction from "./TipAction";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

const ada = { name: "Ada" };
const grace = { name: "Grace" };

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const linked = useSignal(true);
  const strong = useSignal(true);
  const signedIn = useSignal(true);
  const tips = useSignal(false);

  return (
    <section class={["page", className]} style={style} {...attributes}>
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
      <SwitchAction href={linked.value ? "#more" : undefined}>Learn more</SwitchAction>
      <Emphasis strong={strong.value}>Mind the gap</Emphasis>
      <Greeting user={signedIn.value ? ada : undefined}>Welcome back</Greeting>
      <Greeting user={grace} />
      <Greeting />
      <>
        {tips.value ? (
          <div class="tips">
            <TipAction href="#tips" label="Tips">
              Linked tip
            </TipAction>
            <TipAction label="Help">Button tip</TipAction>
            <TipAction href="#about" label="About" />
            <TipAction label="Hint" />
          </div>
        ) : null}
      </>
      <button type="button" onClick$={() => (linked.value = !linked.value)}>
        Toggle link
      </button>
      <button type="button" onClick$={() => (strong.value = !strong.value)}>
        Toggle emphasis
      </button>
      <button type="button" onClick$={() => (signedIn.value = !signedIn.value)}>
        Toggle user
      </button>
      <button type="button" onClick$={() => (tips.value = true)}>
        Show tips
      </button>
    </section>
  );
});
