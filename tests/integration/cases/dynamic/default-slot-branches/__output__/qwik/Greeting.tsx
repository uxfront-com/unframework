import { type CSSProperties, type ClassList, type PropsOf, Slot, component$ } from "@qwik.dev/core";

export interface User {
  name: string;
}

export default component$<
  { user?: User } & Omit<PropsOf<"p">, "user" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ user, class: className, style, ...attributes }) => {
  return (
    <p class={["greeting", className]} style={style} {...attributes}>
      {user ? (
        <b>
          <Slot>{user.name}</Slot>
        </b>
      ) : (
        <i>
          <Slot>Guest</Slot>
        </i>
      )}
    </p>
  );
});
