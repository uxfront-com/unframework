export interface ContactLineProps {
  name: string;
  phone?: string | null;
  verified?: boolean | null;
}

export default function ContactLine({ name, phone, verified }: ContactLineProps) {
  return (
    <section className="contact-line" aria-label={name}>
      <p data-phone={phone === null ? "withheld" : phone}>
        Phone: {phone === null ? "withheld" : (phone ?? "not given yet")}
      </p>
      <p>{verified === null ? "Verification pending" : verified ? "Verified" : "Not verified"}</p>
    </section>
  );
}
