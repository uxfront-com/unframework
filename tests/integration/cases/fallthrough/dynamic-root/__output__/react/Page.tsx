import Base from "./Base";
import Primary from "./Primary";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useRef, useState } from "react";
import "./Page.uf.tsx.css";

export interface PageAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Page({ className, style, ...attributes }: PageAttributes) {
  const [linked, setLinked] = useState(true);
  const linkedRef = useRef(linked);
  const [tone, setTone] = useState("rgb(29, 78, 216)");
  const toneRef = useRef(tone);
  const [pressed, setPressed] = useState("none");
  const pressedRef = useRef(pressed);
  const [items] = useState([
    { id: 1, href: "#one", disabled: true, label: "One" },
    { id: 2, href: "", disabled: true, label: "Two" },
  ]);

  return (
    <section
      className={cx("page", className)}
      style={style}
      data-uf-64cf7c28=""
      {...scopeAttributes(attributes)}
    >
      <Primary
        href={linked ? "#docs" : undefined}
        disabled={true}
        text="Docs"
        onPress={() => {
          pressedRef.current = "docs";
          setPressed(pressedRef.current);
        }}
        className="wide"
        style={{ color: tone }}
        data-uf-64cf7c28=""
      />
      <Base
        disabled={true}
        text="Off"
        onPress={() => {
          pressedRef.current = "off";
          setPressed(pressedRef.current);
        }}
        className={cx("off", { muted: !linked })}
        data-uf-64cf7c28=""
      />
      <Base
        text="Save"
        onPress={() => {
          pressedRef.current = "save";
          setPressed(pressedRef.current);
        }}
        className="save"
        data-uf-64cf7c28=""
      />
      <ul aria-label="Items" data-uf-64cf7c28="">
        {items.map((item) => (
          <li key={item.id} data-uf-64cf7c28="">
            {(() => {
              const Tag = item.href ? "a" : "button";
              return (
                <Tag
                  href={Tag === "a" ? item.href : undefined}
                  disabled={Tag === "button" ? item.disabled : undefined}
                  className="item"
                  data-uf-64cf7c28=""
                >
                  {item.label}
                </Tag>
              );
            })()}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          linkedRef.current = !linkedRef.current;
          setLinked(linkedRef.current);
          toneRef.current = linkedRef.current ? "rgb(29, 78, 216)" : "rgb(21, 128, 61)";
          setTone(toneRef.current);
        }}
        data-uf-64cf7c28=""
      >
        Toggle
      </button>
      <output data-uf-64cf7c28="">{pressed}</output>
    </section>
  );
}
