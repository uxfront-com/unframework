import Frame from "./Frame";
import Mat from "./Mat";
import { type ComponentProps, type JSX, mergeProps, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export default function Gallery(
  rawProps: { matted?: boolean } & Omit<ComponentProps<"section">, "matted" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const props = mergeProps({ matted: true } satisfies Partial<{ matted?: boolean }>, rawProps);
  const [, others] = splitProps(props, ["matted"]);

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
