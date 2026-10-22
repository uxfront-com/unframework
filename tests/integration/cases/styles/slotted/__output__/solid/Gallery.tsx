import Frame from "./Frame";
import Mat from "./Mat";
import { type JSX, mergeProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export default function Gallery(
  rawProps: { matted?: boolean } & { class?: string; style?: JSX.CSSProperties },
) {
  const props = mergeProps({ matted: true } satisfies Partial<{ matted?: boolean }>, rawProps);
  return (
    <section class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Frame>
        <p class="caption" data-uf-9dc516fd-s="">
          A quiet harbour
        </p>
      </Frame>
      <Frame
        label={({ text }) => (
          <p class="caption" data-uf-9dc516fd-s="">
            {text}
          </p>
        )}
      />
      <Dynamic component={props.matted ? Mat : Frame}>
        <p class="caption" data-uf-09929c4a-s="" data-uf-9dc516fd-s="">
          A matted print
        </p>
      </Dynamic>
      <p class="caption">Outside the frame</p>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
