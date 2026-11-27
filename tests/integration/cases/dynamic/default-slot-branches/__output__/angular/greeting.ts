import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface User {
  name: string;
}

@Component({
  selector: "uf-greeting",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let user = this.user();
    <p
      class="greeting"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @if (user) {
        <b>
          <ng-content>{{ user.name }}</ng-content>
        </b>
      } @else {
        <i>
          <ng-content>Guest</ng-content>
        </i>
      }
    </p>
  `,
})
export default class Greeting {
  readonly user = input<User>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLParagraphElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
