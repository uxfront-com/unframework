import Bio from "./Bio";
import NameField from "./NameField";
import { type ComponentProps, type JSX, onCleanup } from "solid-js";

export default function Profile(
  props: Omit<ComponentProps<"form">, "style"> & { style?: JSX.CSSProperties },
) {
  let name: HTMLInputElement | null = null;
  let bio: HTMLInputElement | null = null;

  return (
    <form aria-label="Profile" {...props}>
      <NameField
        ref={(element) => {
          name = element;
          onCleanup(() => {
            name = null;
          });
        }}
        label="Name"
      />
      <button type="button" onClick={() => name?.focus()}>
        Edit name
      </button>
      <Bio
        ref={(element) => {
          bio = element;
          onCleanup(() => {
            bio = null;
          });
        }}
        label="Bio"
      />
      <button type="button" onClick={() => bio?.focus()}>
        Edit bio
      </button>
    </form>
  );
}
