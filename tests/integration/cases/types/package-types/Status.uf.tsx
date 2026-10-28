import type { SubscriptionLike } from "rxjs";

// A member a package declares: `closed`, from rxjs's `SubscriptionLike`.
export type StatusProps = Pick<SubscriptionLike, "closed"> & { label: string };

export default function Status({ closed, label }: StatusProps) {
  return (
    <p>
      {label}: {closed ? "closed" : "open"}
    </p>
  );
}
