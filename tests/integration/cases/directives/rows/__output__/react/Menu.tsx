import Picker from "./Picker";
import { cx } from "./_unframework/cx";
import { listen } from "./_unframework/listen";
import { mergeRefs } from "./_unframework/mergeRefs";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useElementDirective } from "./_unframework/useElementDirective";
import { vMark } from "./vMark";
import { vTrace } from "./vTrace";
import { type CSSProperties, useRef, useState } from "react";

export interface MenuAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Menu({ className, style, ...attributes }: MenuAttributes) {
  const [items, setItems] = useState<{ id: string; label: string; note?: string }[]>([
    { id: "a", label: "Alpha", note: "First" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
  ]);
  const itemsRef = useRef(items);
  const [prefix, setPrefix] = useState("Open");
  const prefixRef = useRef(prefix);
  const [focused, setFocused] = useState(0);
  const focusedRef = useRef(focused);
  const withTrace = useElementDirective(vTrace);
  const withTrace_1 = useElementDirective(vTrace);
  const withTrace_2 = useElementDirective(vTrace);
  const withMark = useElementDirective(vMark);
  const withTrace_3 = useElementDirective(vTrace);
  const withTrace_4 = useElementDirective(vTrace);
  const withTrace_5 = useElementDirective(vTrace);

  return (
    <section
      className={cx("menu", className)}
      aria-label="Menu"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <ul aria-label="Items">
        {items.map((item) => (
          <li key={item.id} data-name={item.id} ref={withTrace_1(item.label)}>
            {item.label}
            {item.note ? (
              <b data-name={`note-${item.id}`} ref={withTrace(item.note)}>
                {item.note}
              </b>
            ) : null}
          </li>
        ))}
      </ul>
      <ul aria-label="Marked">
        {items.map((item) => (
          <li
            key={item.id}
            data-name={`both-${item.id}`}
            ref={mergeRefs(withTrace_2(item.label), withMark(item.id))}
          >
            {item.label}
          </li>
        ))}
      </ul>
      <div className="focus">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            data-name={`focus-${item.id}`}
            ref={mergeRefs(withTrace_3(item.label), (element) =>
              listen(element, "focusin", () => {
                focusedRef.current++;
                setFocused(focusedRef.current);
              }),
            )}
          >
            Focus {item.label}
          </button>
        ))}
      </div>
      <output>{focused}</output>
      <ul aria-label="Prefixed">
        {items.map((item) => (
          <li
            key={item.id}
            data-name={`prefixed-${item.id}`}
            ref={withTrace_4(`${prefix} ${item.label}`)}
          >
            {item.label}
          </li>
        ))}
      </ul>
      <Picker
        renderOption={({ option }) => (
          <span data-name={`option-${option.id}`} ref={withTrace_5(`${prefix} ${option.label}`)}>
            {option.label}
          </span>
        )}
      />
      <button
        type="button"
        onClick={() => {
          itemsRef.current = itemsRef.current.map((item) =>
            item.id === "a" ? { id: "a", label: "Alpha 2", note: "First" } : item,
          );
          setItems(itemsRef.current);
        }}
      >
        Rename first
      </button>
      <button
        type="button"
        onClick={() => {
          itemsRef.current = [...itemsRef.current].reverse();
          setItems(itemsRef.current);
        }}
      >
        Reverse
      </button>
      <button
        type="button"
        onClick={() => {
          itemsRef.current = itemsRef.current.filter((item) => item.id !== "b");
          setItems(itemsRef.current);
        }}
      >
        Remove second
      </button>
      <button
        type="button"
        onClick={() => {
          itemsRef.current = [...itemsRef.current, { id: "d", label: "Delta" }];
          setItems(itemsRef.current);
        }}
      >
        Add item
      </button>
      <button
        type="button"
        onClick={() => {
          prefixRef.current = "Close";
          setPrefix(prefixRef.current);
        }}
      >
        Change prefix
      </button>
    </section>
  );
}
