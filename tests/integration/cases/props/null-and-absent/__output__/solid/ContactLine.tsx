import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface ContactLineProps {
  name: string;
  phone?: string | null;
  verified?: boolean | null;
}

export default function ContactLine(
  props: ContactLineProps &
    Omit<ComponentProps<"section">, "name" | "phone" | "verified" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["name", "phone", "verified", "class"]);

  return (
    <section
      class={props.class ? `contact-line ${props.class}` : "contact-line"}
      aria-label={props.name}
      {...others}
    >
      <p data-phone={props.phone === null ? "withheld" : props.phone}>
        Phone: {props.phone === null ? "withheld" : (props.phone ?? "not given yet")}
      </p>
      <p>
        {props.verified === null
          ? "Verification pending"
          : props.verified
            ? "Verified"
            : "Not verified"}
      </p>
    </section>
  );
}
