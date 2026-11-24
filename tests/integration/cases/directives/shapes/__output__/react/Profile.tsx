import { cx } from "./_unframework/cx";
import { useDirective } from "./_unframework/useDirective";
import { vSelectable } from "./vSelectable";
import { type ComponentPropsWithRef, useRef, useState } from "react";

interface User {
  name: string;
}

export type ProfileAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

const hooks = "data-hooks";
const element = "data-element";

const vMark = {
  mounted(el: HTMLElement, value: string) {
    el.setAttribute(hooks, value);
    el.setAttribute(element, "mounted");
    return el;
  },
  updated(el: HTMLElement, value: string) {
    const oldValue = "updated";
    el.setAttribute(hooks, `${oldValue} ${value}`);
  },
  unmounted() {},
};

export default function Profile({ className, style, ...attributes }: ProfileAttributes) {
  const [user, setUser] = useState<User | null>({ name: "Ada" });
  const userRef = useRef(user);
  const [note, setNote] = useState("Hello");
  const [label, setLabel] = useState<string | number>("Lovelace");
  const labelRef = useRef(label);
  const [nick, setNick] = useState<string | undefined>("Al");
  const nickRef = useRef(nick);
  const [track] = useState("Trail");
  const [cleanup] = useState<string | null>("Tidy");
  const markRef = useDirective(vMark, () => user!.name);
  const markRef_1 = useDirective(vMark, () => label);
  const markRef_2 = useDirective(vMark, () => nick);
  const markRef_3 = useDirective(vMark, () => cleanup! + track);
  const markRef_4 = useDirective(vMark, () => note);
  const selectableRef = useDirective(vSelectable, () => true);

  const [noteCaret] = useState(() => (element: HTMLTextAreaElement | null) => {
    if (element) {
      const text = element.value;
      element.value = "";
      element.value = text;
    }
    const detaches = [markRef_4(element), selectableRef(element)];
    return () => {
      for (const detach of detaches) detach();
    };
  });

  return (
    <section
      className={cx("profile", className)}
      aria-label="Profile"
      style={style}
      {...attributes}
    >
      {user ? <p ref={markRef}>{user.name}</p> : null}
      {typeof label === "string" ? <b ref={markRef_1}>{label}</b> : null}
      {nick ? <i ref={markRef_2}>{nick}</i> : null}
      {cleanup ? <s ref={markRef_3}>{cleanup}</s> : null}
      <textarea
        aria-label="Note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        ref={noteCaret}
      />
      <button
        type="button"
        onClick={() => {
          userRef.current = userRef.current ? null : { name: "Grace" };
          setUser(userRef.current);
        }}
      >
        Toggle
      </button>
      <button
        type="button"
        onClick={() => {
          labelRef.current = 1;
          setLabel(labelRef.current);
        }}
      >
        Count
      </button>
      <button
        type="button"
        onClick={() => {
          nickRef.current = undefined;
          setNick(nickRef.current);
        }}
      >
        Forget
      </button>
    </section>
  );
}
