import KeepAlive from "./KeepAlive";
import Transition from "./Transition";
import TransitionComponent from "./TransitionComponent";
import type { CSSProperties } from "react";

export interface WizardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Wizard({ className, style }: WizardAttributes) {
  return (
    <section aria-label="Wizard" className={className} style={style}>
      <Transition step="details" />
      <TransitionComponent />
      <KeepAlive level={2} />
    </section>
  );
}
