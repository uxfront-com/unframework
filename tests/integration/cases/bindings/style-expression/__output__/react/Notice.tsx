import Badge from "./Badge";
import Tag from "./Tag";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { styleObject } from "./_unframework/styleObject";
import { type CSSProperties, useRef, useState } from "react";

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

export interface NoticeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Notice({
  title,
  look,
  declarations,
  vars,
  className,
  style,
  ...attributes
}: NoticeProps & NoticeAttributes) {
  const [quiet, setQuiet] = useState(false);
  const quietRef = useRef(quiet);

  function toggle() {
    quietRef.current = !quietRef.current;
    setQuiet(quietRef.current);
  }

  const Tag_1 = quiet ? Tag : Badge;

  return (
    <div className={cx("notice", className)} style={style} {...scopeAttributes(attributes)}>
      <p style={styleObject(look)}>{title}</p>
      <Badge
        label="Permanent"
        tone="padding: 2px 6px; color: rgb(120, 30, 30); outline: 1px solid"
        style={styleObject(look)}
      />
      <p style={styleObject(declarations)}>Read the details before you continue.</p>
      <Tag_1 label="Optional" tone="font-weight: 700" style={styleObject(declarations)} />
      <p
        style={styleObject(
          quiet
            ? { color: "rgb(90, 90, 90)" }
            : { color: "var(--notice-accent, rgb(160, 40, 40))", fontWeight: "700" },
        )}
      >
        This cannot be undone.
      </p>
      <button type="button" style={styleObject(vars)} onClick={toggle}>
        {quiet ? "Emphasise" : "Quieten"}
      </button>
    </div>
  );
}
