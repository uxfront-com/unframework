import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, output } from "@angular/core";

@Component({
  selector: "uf-base",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let href = this.href();
    @let disabled = this.disabled();
    @let text = this.text();
    @switch (href ? "a" : "button") {
      @case ("a") {
        <a
          [attr.href]="href"
          class="base"
          [style]="{ padding: '4px 8px', ...this.style() }"
          (click)="onPress($event)"
          [class]="this.class()"
          [ufScope]="this.host"
        >{{ text }}</a>
      } @case ("button") {
        <button
          [attr.disabled]="disabled ? '' : null"
          class="base"
          [style]="{ padding: '4px 8px', ...this.style() }"
          (click)="onPress($event)"
          [class]="this.class()"
          [ufScope]="this.host"
        >{{ text }}</button>
      }
    }
  `,
})
export default class Base {
  readonly href = input<string>();
  readonly disabled = input<boolean>();
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly press = output<void>();

  protected onPress(event: MouseEvent) {
    event.preventDefault();
    this.press.emit();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
