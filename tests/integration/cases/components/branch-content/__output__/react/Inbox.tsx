import Notice from "./Notice";
import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type InboxAttributes = Omit<ComponentPropsWithRef<"div">, "unread" | "children">;

export default function Inbox({
  unread,
  className,
  style,
  ...attributes
}: { unread: number } & InboxAttributes) {
  const [count, setCount] = useState(unread);
  const countRef = useRef(count);

  return (
    <div className={cx("inbox", className)} style={style} {...attributes}>
      {count > 0 ? (
        <Notice text={`${count} unread`} tone="info" />
      ) : (
        <Notice text="All read" tone="quiet" />
      )}
      <button
        type="button"
        onClick={() => {
          countRef.current = 0;
          setCount(countRef.current);
        }}
      >
        Mark all read
      </button>
    </div>
  );
}
