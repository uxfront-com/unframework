import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface ContactLineProps {
  name: string;
  phone?: string | null;
  verified?: boolean | null;
}

export default component$<
  ContactLineProps &
    Omit<PropsOf<"section">, "name" | "phone" | "verified" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ name, phone, verified, class: className, style, ...attributes }) => {
  return (
    <section class={["contact-line", className]} aria-label={name} style={style} {...attributes}>
      <p data-phone={phone === null ? "withheld" : phone}>
        Phone: {phone === null ? "withheld" : (phone ?? "not given yet")}
      </p>
      <p>{verified === null ? "Verification pending" : verified ? "Verified" : "Not verified"}</p>
    </section>
  );
});
