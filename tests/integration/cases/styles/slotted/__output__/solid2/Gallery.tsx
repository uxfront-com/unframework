import Frame from "./Frame";
import Mat from "./Mat";
import { Dynamic, type JSX } from "@solidjs/web";
import { merge } from "solid-js";

export default function Gallery(
  rawProps: { matted?: boolean } & { class?: string; style?: JSX.CSSProperties },
) {
  const props = merge(rawProps, {
    get matted() {
      return rawProps.matted === undefined ? true : rawProps.matted;
    },
  });
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
