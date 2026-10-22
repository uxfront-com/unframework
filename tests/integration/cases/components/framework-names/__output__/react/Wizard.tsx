import KeepAlive from "./KeepAlive";
import Transition from "./Transition";
import TransitionComponent from "./TransitionComponent";
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
