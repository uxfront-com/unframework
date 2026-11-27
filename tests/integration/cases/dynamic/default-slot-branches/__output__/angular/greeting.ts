import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { NgTemplateOutlet } from "@angular/common";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface User {
  name: string;
}

@Component({
  selector: "uf-greeting",
  imports: [NgTemplateOutlet, ScopeAttributes, Fallthrough],
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
      <ng-template #defaultSlot let-fallback>
        <ng-content>
          <ng-container [ngTemplateOutlet]="fallback" />
        </ng-content>
      </ng-template>
      @if (user) {
        <b>
          <ng-template #defaultSlotFallback>{{ user.name }}</ng-template>
          <ng-container
            [ngTemplateOutlet]="defaultSlot"
            [ngTemplateOutletContext]="{ $implicit: defaultSlotFallback }"
          />
        </b>
      } @else {
        <i>
          <ng-template #defaultSlotFallback_1>Guest</ng-template>
          <ng-container
            [ngTemplateOutlet]="defaultSlot"
            [ngTemplateOutletContext]="{ $implicit: defaultSlotFallback_1 }"
          />
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
