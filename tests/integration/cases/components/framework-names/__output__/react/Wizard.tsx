import KeepAlive from "./KeepAlive";
import Transition from "./Transition";
import TransitionComponent from "./TransitionComponent";
import type { ComponentPropsWithRef } from "react";

export type WizardAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Wizard({ className, style, ...attributes }: WizardAttributes) {
  return (
    <section aria-label="Wizard" className={className} style={style} {...attributes}>
      <Transition step="details" />
      <TransitionComponent />
      <KeepAlive level={2} />
    </section>
  );
}
