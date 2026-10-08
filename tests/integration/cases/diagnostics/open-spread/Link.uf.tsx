// UF3048 open-spread: a spread renders the keys its type declares, and a union of two object
// types declares no keys of its own: which keys render is known only when the code runs
// (ADR-0054).
export interface Titled {
  title: string;
}

export interface Labelled {
  id: string;
}

export default function Link({ href, extra }: { href: string; extra: Titled | Labelled }) {
  return (
    <a href={href} {...extra}>
      Docs
    </a>
  );
}
