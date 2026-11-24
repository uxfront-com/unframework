import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Card, { CardFooter, CardHeader } from "./card";
import { Component, ElementRef, computed, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-post",
  imports: [Card, CardHeader, CardFooter, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let author = this.author();
    <uf-card
      [class]="this.class()"
      [style]="this.style()"
      [ufAttributes]="this.ufAttributes()"
      [ufListeners]="this.ufListeners()"
      [ufScope]="this.host"
      #ufElement
    >
      <p>Slots arrive in M3.</p>
      <ng-template ufCardHeader>
        <h2>Release notes</h2>
      </ng-template>
      <ng-template ufCardFooter>
        <small>By {{ author }}</small>
      </ng-template>
    </uf-card>
  `,
})
export default class Post {
  readonly author = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly rootComponent = viewChild("ufElement", { read: Card });
  readonly ufElement = computed(() => this.rootComponent()?.ufElement());
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
