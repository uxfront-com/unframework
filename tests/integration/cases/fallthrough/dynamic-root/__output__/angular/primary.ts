import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Base from "./base";
import { Component, ElementRef, inject, input, output } from "@angular/core";

@Component({
  selector: "uf-primary",
  imports: [Base, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let href = this.href();
    @let disabled = this.disabled();
    @let text = this.text();
    <uf-base
      [href]="href"
      [disabled]="disabled"
      [text]="text"
      [class]="['primary', this.class()].join(' ')"
      (press)="press.emit()"
      [style]="this.style()"
      [ufScope]="this.host"
    />
  `,
})
export default class Primary {
  readonly href = input<string>();
  readonly disabled = input<boolean>();
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly press = output<void>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
