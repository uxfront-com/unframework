import KeepAlive from "./KeepAlive";
import Transition from "./Transition";
import TransitionComponent from "./TransitionComponent";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface WizardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Wizard({ className, style, ...attributes }: WizardAttributes) {
  return (
    <section
      aria-label="Wizard"
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Transition step="details" />
      <TransitionComponent />
      <KeepAlive level={2} />
    </section>
  );
}
