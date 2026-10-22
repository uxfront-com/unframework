import { type CSSProperties, useEffect, useEffectEvent, useRef, useState } from "react";

export interface NetworkBadgeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function NetworkBadge({ className, style, ...attributes }: NetworkBadgeAttributes) {
  const [online, setOnline] = useState<boolean>();
  const onlineRef = useRef(online);
  const [label, setLabel] = useState("Checking the connection");
  const labelRef = useRef(label);

  const previousOnline = useRef(online);
  const onOnlineChange = useEffectEvent((value: typeof online) => {
    labelRef.current = value ? "Online" : "Offline";
    setLabel(labelRef.current);
  });
  useEffect(() => {
    const previous = previousOnline.current;
    if (Object.is(previous, online)) return;
    previousOnline.current = online;
    onOnlineChange(online);
  }, [online]);

  const onMount = useEffectEvent(() => {
    onlineRef.current = navigator.onLine;
    setOnline(onlineRef.current);
  });
  useEffect(() => {
    onMount();
  }, []);

  return (
    <p
      className={cx("network-badge", className)}
      role="status"
      data-checked={online === undefined ? "no" : "yes"}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {label}
    </p>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
