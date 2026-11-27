import { ref } from "@uxfront/unframework";

import Emphasis from "./Emphasis.uf.tsx";
import FadeAction from "./FadeAction.uf.tsx";
import Greeting from "./Greeting.uf.tsx";
import IconAction from "./IconAction.uf.tsx";
import LabelAction from "./LabelAction.uf.tsx";
import SwitchAction from "./SwitchAction.uf.tsx";
import TipAction from "./TipAction.uf.tsx";

export default function Page() {
  const linked = ref(true);
  const strong = ref(true);
  const signedIn = ref(true);
  const tips = ref(false);
  const ada = { name: "Ada" };
  const grace = { name: "Grace" };
  return (
    <section class="page">
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
      {tips.value && (
        <div class="tips">
          <TipAction href="#tips" label="Tips">
            Linked tip
          </TipAction>
          <TipAction label="Help">Button tip</TipAction>
          <TipAction href="#about" label="About" />
          <TipAction label="Hint" />
        </div>
      )}
      <button type="button" onClick={() => (linked.value = !linked.value)}>
        Toggle link
      </button>
      <button type="button" onClick={() => (strong.value = !strong.value)}>
        Toggle emphasis
      </button>
      <button type="button" onClick={() => (signedIn.value = !signedIn.value)}>
        Toggle user
      </button>
      <button type="button" onClick={() => (tips.value = true)}>
        Show tips
      </button>
    </section>
  );
}
