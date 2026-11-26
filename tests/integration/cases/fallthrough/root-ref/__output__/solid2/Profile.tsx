import Bio from "./Bio";
import NameField from "./NameField";
import { clearedRef } from "./_unframework/clearedRef";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Profile(
  props: Omit<ComponentProps<"form">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  let name: HTMLInputElement | null = null;
  let bio: HTMLInputElement | null = null;

  return (
    <form aria-label="Profile" {...props}>
      <NameField
        ref={clearedRef(
          (element) => {
            name = element;
          },
          () => {
            name = null;
          },
        )}
        label="Name"
      />
      <button type="button" onClick={() => name?.focus()}>
        Edit name
      </button>
      <Bio
        ref={clearedRef(
          (element) => {
            bio = element;
          },
          () => {
            bio = null;
          },
        )}
        label="Bio"
      />
      <button type="button" onClick={() => bio?.focus()}>
        Edit bio
      </button>
    </form>
  );
}
