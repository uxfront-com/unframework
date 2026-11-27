import Emphasis from "./Emphasis";
import FadeAction from "./FadeAction";
import Greeting from "./Greeting";
import IconAction from "./IconAction";
import LabelAction from "./LabelAction";
import SwitchAction from "./SwitchAction";
import TipAction from "./TipAction";
import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type PageAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

const ada = { name: "Ada" };

const grace = { name: "Grace" };

export default function Page({ className, style, ...attributes }: PageAttributes) {
  const [linked, setLinked] = useState(true);
  const linkedRef = useRef(linked);
  const [strong, setStrong] = useState(true);
  const strongRef = useRef(strong);
  const [signedIn, setSignedIn] = useState(true);
  const signedInRef = useRef(signedIn);
  const [tips, setTips] = useState(false);
  const tipsRef = useRef(tips);

  return (
    <section className={cx("page", className)} style={style} {...attributes}>
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
      <SwitchAction href={linked ? "#more" : undefined}>Learn more</SwitchAction>
      <Emphasis strong={strong}>Mind the gap</Emphasis>
      <Greeting user={signedIn ? ada : undefined}>Welcome back</Greeting>
      <Greeting user={grace} />
      <Greeting />
      {tips ? (
        <div className="tips">
          <TipAction href="#tips" label="Tips">
            Linked tip
          </TipAction>
          <TipAction label="Help">Button tip</TipAction>
          <TipAction href="#about" label="About" />
          <TipAction label="Hint" />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => {
          linkedRef.current = !linkedRef.current;
          setLinked(linkedRef.current);
        }}
      >
        Toggle link
      </button>
      <button
        type="button"
        onClick={() => {
          strongRef.current = !strongRef.current;
          setStrong(strongRef.current);
        }}
      >
        Toggle emphasis
      </button>
      <button
        type="button"
        onClick={() => {
          signedInRef.current = !signedInRef.current;
          setSignedIn(signedInRef.current);
        }}
      >
        Toggle user
      </button>
      <button
        type="button"
        onClick={() => {
          tipsRef.current = true;
          setTips(tipsRef.current);
        }}
      >
        Show tips
      </button>
    </section>
  );
}
