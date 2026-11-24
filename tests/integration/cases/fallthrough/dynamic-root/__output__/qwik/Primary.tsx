import Base from "./Base";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface PrimaryEvents {
  onPress$?: QRL<() => void>;
}

export default component$<
  { href?: string; disabled?: boolean; text: string } & PrimaryEvents &
    Omit<PropsOf<typeof Base>, "href" | "disabled" | "text" | "onPress$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ href, disabled, text, onPress$, class: className, style, ...attributes }) => {
  return (
    <>
      <Base
        href={href}
        disabled={disabled}
        text={text}
        class={["primary", className]}
        onPress$={() => onPress$?.()}
        style={style}
        {...attributes}
      />
    </>
  );
});
