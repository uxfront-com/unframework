import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface BannerProps {
  message: string;
  tone: string;
  emphasis?: string | null;
}

export default component$<BannerProps & { class?: ClassList; style?: CSSProperties }>(
  ({ message, tone, emphasis, class: className, style, ...attributes }) => {
    return (
      <div
        class={["banner", tone, className]}
        role="note"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p class={emphasis}>{message}</p>
        <p class={`banner-footer banner-footer-${tone}`}>Shown to every visitor.</p>
      </div>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
