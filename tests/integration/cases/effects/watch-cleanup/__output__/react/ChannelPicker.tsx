import {
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface ChannelPickerEvents {
  onJoin?: (channel: string) => void;
  onLeave?: (channel: string) => void;
}

export interface ChannelPickerAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ChannelPicker({
  onJoin,
  onLeave,
  className,
  style,
  ...attributes
}: ChannelPickerEvents & ChannelPickerAttributes) {
  const onLeaveRef = useRef(onLeave);
  useLayoutEffect(() => {
    onLeaveRef.current = onLeave;
  });

  const [channel, setChannel] = useState("general");
  const channelRef = useRef(channel);

  const watchedName = useMemo(() => channel.toLowerCase(), [channel]);
  const previousName = useRef<typeof watchedName | undefined>(undefined);
  const onNameChange = useEffectEvent(
    (
      name: typeof watchedName,
      previous: typeof watchedName | undefined,
      onCleanup: (cleanup: () => void) => void,
    ) => {
      onJoin?.(name);
      onCleanup(() => {
        onLeaveRef.current?.(name);
      });
    },
  );
  useEffect(() => {
    const previous = previousName.current;
    previousName.current = watchedName;
    const cleanups: (() => void)[] = [];
    onNameChange(watchedName, previous, (cleanup) => void cleanups.push(cleanup));
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [watchedName]);

  return (
    <section
      className={cx("channel-picker", className)}
      aria-label="Channels"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p role="status">Channel: #{channel}</p>
      <button
        type="button"
        onClick={() => {
          channelRef.current = "random";
          setChannel(channelRef.current);
        }}
      >
        Join #random
      </button>
      <button
        type="button"
        onClick={() => {
          channelRef.current = "General";
          setChannel(channelRef.current);
        }}
      >
        Join #General
      </button>
    </section>
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
