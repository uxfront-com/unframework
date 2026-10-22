import Frame from "./Frame";
import Mat from "./Mat";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ matted?: boolean } & { class?: ClassList; style?: CSSProperties }>(
  ({ matted = true, class: className, style, ...attributes }) => {
    const Tag = matted ? Mat : Frame;

    return (
      <section {...scopeAttributes(attributes)} class={className} style={style}>
        <Frame>
          <p class="caption" data-uf-9dc516fd-s="">
            A quiet harbour
          </p>
        </Frame>
        <Frame
          label$={({ text }) => (
            <p class="caption" data-uf-9dc516fd-s="">
              {text}
            </p>
          )}
        />
        <>
          <Tag>
            <p class="caption" data-uf-09929c4a-s="" data-uf-9dc516fd-s="">
              A matted print
            </p>
          </Tag>
        </>
        <p class="caption">Outside the frame</p>
      </section>
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
