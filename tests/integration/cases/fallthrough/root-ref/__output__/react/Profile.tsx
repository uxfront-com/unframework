import Bio from "./Bio";
import NameField from "./NameField";
import { type ComponentPropsWithRef, useRef } from "react";

export type ProfileAttributes = Omit<ComponentPropsWithRef<"form">, "children">;

export default function Profile({ className, style, ...attributes }: ProfileAttributes) {
  const name = useRef<HTMLInputElement>(null);
  const bio = useRef<HTMLInputElement>(null);

  return (
    <form aria-label="Profile" className={className} style={style} {...attributes}>
      <NameField ref={name} label="Name" />
      <button type="button" onClick={() => name.current?.focus()}>
        Edit name
      </button>
      <Bio ref={bio} label="Bio" />
      <button type="button" onClick={() => bio.current?.focus()}>
        Edit bio
      </button>
    </form>
  );
}
