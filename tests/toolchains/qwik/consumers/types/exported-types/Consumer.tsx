import { component$ } from "@qwik.dev/core";

import Button, {
  type ButtonProps,
  type ButtonSize,
} from "../../../../../integration/cases/types/exported-types/__output__/qwik/Button";

export const Consumer = component$(() => {
  const props: ButtonProps = { label: "Save", tone: "secondary" };
  const size: ButtonSize = "large";
  return <Button label={props.label} tone={props.tone} data-size={size} />;
});
