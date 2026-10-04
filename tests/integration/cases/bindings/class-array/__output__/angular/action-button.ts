import { Component, input } from "@angular/core";

export interface ActionButtonProps {
  label: string;
  size: "small" | "medium" | "large";
  primary: boolean;
  busy?: boolean;
  badge: number;
}

@Component({
  selector: "uf-action-button",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let size = this.size();
    @let primary = this.primary();
    @let busy = this.busy();
    @let badge = this.badge();
    <button
      type="button"
      class="button"
      [class]="[('button-' + size), primary ? 'button-primary' : null, busy ? 'is-busy' : null, busy ? 'button-waiting' : null, badge ? 'has-badge' : null, primary ? 'solid' : 'outline'].join(' ')"
    >{{ label }}</button>
  `,
})
export default class ActionButton {
  readonly label = input.required<string>();
  readonly size = input.required<"small" | "medium" | "large">();
  readonly primary = input.required<boolean>();
  readonly busy = input<boolean, boolean | undefined>(false, {
    transform: (value) => (value === undefined ? false : value),
  });
  readonly badge = input.required<number>();
}
