export interface ContactLineProps {
  name: string;
  phone?: string | null;
  verified?: boolean | null;
}

export default function ContactLine(props: ContactLineProps) {
  return (
    <section class="contact-line" aria-label={props.name}>
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
