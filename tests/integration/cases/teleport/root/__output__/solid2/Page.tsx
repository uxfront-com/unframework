import Toast from "./Toast";
import type { JSX } from "@solidjs/web";
import "./Page.uf.tsx.css";

export interface PageProps {
  message: string;
}

export default function Page(props: PageProps & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <section
      class={props.class ? `page ${props.class}` : "page"}
      aria-label="Page"
      data-uf-5a3bed67=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p data-uf-5a3bed67="">Saving…</p>
      <Toast message={props.message} data-uf-5a3bed67="" />
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
