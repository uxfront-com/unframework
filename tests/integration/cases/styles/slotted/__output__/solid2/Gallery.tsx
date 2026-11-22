import Frame from "./Frame";
import Mat from "./Mat";
import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";

export default function Gallery(
  rawProps: { matted?: boolean } & Omit<ComponentProps<"section">, "matted" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const props = merge(rawProps, {
    get matted() {
      return rawProps.matted === undefined ? true : rawProps.matted;
    },
  });
  const others = omit(props, "matted");

  return (
    <section {...others}>
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
