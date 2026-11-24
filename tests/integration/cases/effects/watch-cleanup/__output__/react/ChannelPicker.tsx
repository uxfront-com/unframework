import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
