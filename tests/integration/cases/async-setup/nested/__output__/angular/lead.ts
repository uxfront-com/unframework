import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Member from "./member";
import { Component, ElementRef, inject, input } from "@angular/core";

@Component({
  selector: "uf-lead",
  imports: [Member, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let id = this.id();
    <uf-member
      [id]="id"
      [class]="this.class()"
      [style]="this.style()"
      [ufAttributes]="this.ufAttributes()"
      [ufListeners]="this.ufListeners()"
      [ufScope]="this.host"
    />
  `,
})
export default class Lead {
  readonly id = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
