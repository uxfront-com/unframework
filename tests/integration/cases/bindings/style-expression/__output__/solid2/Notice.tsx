import Badge from "./Badge";
import Tag from "./Tag";
import { createState } from "./_unframework/createState";
import { styleProperties } from "./_unframework/styleProperties";
import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { omit } from "solid-js";

type NoticeLook = {
  color?: string;
  backgroundColor?: string;
  borderLeft?: string;
  "--notice-accent"?: string;
};

type NoticeVars = { "--notice-gap"?: string };

export interface NoticeProps {
  title: string;
  look?: NoticeLook;
  declarations?: string;
  vars?: NoticeVars;
}

export default function Notice(
  props: NoticeProps &
    Omit<ComponentProps<"div">, "title" | "look" | "declarations" | "vars" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "look", "declarations", "vars", "class");

  const [quiet, setQuiet] = createState(false);

  function toggle() {
    setQuiet(!quiet());
  }

  return (
    <div class={props.class ? `notice ${props.class}` : "notice"} {...others}>
      <p style={styleProperties(props.look)}>{props.title}</p>
      <Badge
        label="Permanent"
        tone="padding: 2px 6px; color: rgb(120, 30, 30); outline: 1px solid"
        style={styleProperties(props.look)}
      />
      <p style={styleProperties(props.declarations)}>Read the details before you continue.</p>
      <Dynamic
        component={quiet() ? Tag : Badge}
        label="Optional"
        tone="font-weight: 700"
        style={styleProperties(props.declarations)}
      />
      <p
        style={styleProperties(
          quiet()
            ? { color: "rgb(90, 90, 90)" }
            : { color: "var(--notice-accent, rgb(160, 40, 40))", fontWeight: "700" },
        )}
      >
        This cannot be undone.
      </p>
      <button type="button" style={styleProperties(props.vars)} onClick={toggle}>
        {quiet() ? "Emphasise" : "Quieten"}
      </button>
    </div>
  );
}
