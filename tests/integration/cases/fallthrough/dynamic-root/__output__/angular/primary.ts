import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Base from "./base";
import { Component, ElementRef, computed, inject, input, output, viewChild } from "@angular/core";

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
      [ufAttributes]="this.ufAttributes()"
      [ufListeners]="this.ufListeners()"
      [ufScope]="this.host"
      #ufElement
    />
  `,
})
export default class Primary {
  readonly href = input<string>();
  readonly disabled = input<boolean>();
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly press = output<void>();
  private readonly rootComponent = viewChild("ufElement", { read: Base });
  readonly ufElement = computed(() => this.rootComponent()?.ufElement());
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
