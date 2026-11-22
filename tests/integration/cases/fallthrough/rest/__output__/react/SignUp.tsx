import Field from "./Field";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type SignUpAttributes = Omit<ComponentPropsWithRef<"form">, "children">;

export default function SignUp({ className, style, ...attributes }: SignUpAttributes) {
  const [focuses, setFocuses] = useState(0);
  const focusesRef = useRef(focuses);

  return (
    <form aria-label="Sign up" className={className} style={style} {...attributes}>
      <p id="email-hint">We never share it.</p>
      <Field
        label="Email"
        className="wide"
        style={{ marginTop: "4px" }}
        id="email"
        aria-describedby="email-hint"
        placeholder="you@example.com"
        onFocus={() => {
          focusesRef.current++;
          setFocuses(focusesRef.current);
        }}
      />
      <p>Focuses: {focuses}</p>
    </form>
  );
}
