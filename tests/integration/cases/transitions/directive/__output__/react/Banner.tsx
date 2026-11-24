import { Transition } from "./_unframework/Transition";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useDirective } from "./_unframework/useDirective";
import { vMark } from "./vMark";
import { type CSSProperties, useRef, useState } from "react";
import "./Banner.uf.tsx.css";

export interface BannerAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Banner({ className, style, ...attributes }: BannerAttributes) {
  const [shown, setShown] = useState(true);
  const shownRef = useRef(shown);
  const markRef = useDirective(vMark, () => "banner");

  return (
    <section
      aria-label="News"
      className={className}
      style={style}
      data-uf-53025c4a=""
      {...scopeAttributes(attributes)}
    >
      <button
        type="button"
        onClick={() => {
          shownRef.current = false;
          setShown(shownRef.current);
        }}
        data-uf-53025c4a=""
      >
        Dismiss
      </button>
      <Transition name="fade">
        {shown ? (
          <p key={0} className="banner" ref={markRef} data-uf-53025c4a="">
            New releases are out.
          </p>
        ) : null}
      </Transition>
    </section>
  );
}
