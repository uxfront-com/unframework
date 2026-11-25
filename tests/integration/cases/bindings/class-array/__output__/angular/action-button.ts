import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface ActionButtonProps {
  label: string;
  size: "small" | "medium" | "large";
  primary: boolean;
  busy?: boolean;
  badge: number;
}

@Component({
  selector: "uf-action-button",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
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
      [class]="['button-' + size, primary ? 'button-primary' : null, busy ? 'is-busy' : null, busy ? 'button-waiting' : null, badge ? 'has-badge' : null, primary ? 'solid' : 'outline', this.class()].join(' ')"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
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
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLButtonElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
