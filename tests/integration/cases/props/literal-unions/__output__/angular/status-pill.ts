import { Component, input } from "@angular/core";

export interface StatusPillProps {
  status: "active" | "paused" | "archived";
  size?: "small" | "large";
  level?: 1 | 2 | 3;
}

@Component({
  selector: "uf-status-pill",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let status = this.status();
    @let size = this.size();
    @let level = this.level();
    <span
      class="pill"
      [class]="['pill-' + status, 'pill-' + size, 'pill-level-' + level].join(' ')"
    >{{ status === "active" ? "Active" : status === "paused" ? "Paused" : "Archived" }}{{ level === 3 ? " (critical)" : "" }}</span>
  `,
})
export default class StatusPill {
  readonly status = input.required<"active" | "paused" | "archived">();
  readonly size = input<"small" | "large", "small" | "large" | undefined>("small", {
    transform: (value) => (value === undefined ? "small" : value),
  });
  readonly level = input<1 | 2 | 3, 1 | 2 | 3 | undefined>(1, {
    transform: (value) => (value === undefined ? 1 : value),
  });
}
