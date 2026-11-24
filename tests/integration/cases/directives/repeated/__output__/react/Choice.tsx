import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, type ReactNode, useRef, useState } from "react";

export interface ChoiceSlots {
  body?: ReactNode;
}

export interface ChoiceAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Choice({
  body,
  className,
  style,
  ...attributes
}: ChoiceSlots & ChoiceAttributes) {
  const [first, setFirst] = useState(true);
  const firstRef = useRef(first);

  return (
    <div className={cx("choice", className)} style={style} {...scopeAttributes(attributes)}>
      {first ? <b>{body}</b> : <i>{body}</i>}
      <button
        type="button"
        onClick={() => {
          firstRef.current = !firstRef.current;
          setFirst(firstRef.current);
        }}
      >
        Switch
      </button>
    </div>
  );
}
