import { Transition } from "./_unframework/Transition";
import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef, useState } from "react";
import "./Steps.uf.tsx.css";

export type StepsAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Steps({ className, style, ...attributes }: StepsAttributes) {
  const [first, setFirst] = useState(true);
  const firstRef = useRef(first);
  const [step, setStep] = useState(1);
  const stepRef = useRef(step);

  return (
    <section
      className={cx("steps", className)}
      aria-label="Checkout"
      style={style}
      data-uf-84fe8ccf=""
      {...attributes}
    >
      <button
        type="button"
        onClick={() => {
          firstRef.current = !firstRef.current;
          setFirst(firstRef.current);
        }}
        data-uf-84fe8ccf=""
      >
        Swap
      </button>
      <Transition name="swap">
        {first ? (
          <p key={0} className="card" data-uf-84fe8ccf="">
            Cart
          </p>
        ) : (
          <p key={1} className="card" data-uf-84fe8ccf="">
            Payment
          </p>
        )}
      </Transition>
      <button
        type="button"
        onClick={() => {
          stepRef.current = (stepRef.current % 3) + 1;
          setStep(stepRef.current);
        }}
        data-uf-84fe8ccf=""
      >
        Next
      </button>
      <Transition name="step">
        {step === 1 ? (
          <p key={0} className="step" data-uf-84fe8ccf="">
            Step one
          </p>
        ) : step === 2 ? (
          <p key={1} className="step" data-uf-84fe8ccf="">
            Step two
          </p>
        ) : (
          <p key={2} className="step" data-uf-84fe8ccf="">
            Step three
          </p>
        )}
      </Transition>
    </section>
  );
}
