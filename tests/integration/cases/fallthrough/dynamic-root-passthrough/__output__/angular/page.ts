import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Base from "./base";
import Primary from "./primary";
import { Component, ElementRef, computed, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-page",
  imports: [Base, Primary, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let linked = this.linked();
    @let log = this.log();
    <section
      aria-label="Page"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-base
        [href]="linked ? '#direct' : undefined"
        [text]="'Direct'"
        #direct
        [ufAttributes]="{ id: 'direct', 'aria-label': 'Direct', 'data-testid': 'direct', title: 'Go' }"
        [ufListeners]="{ click: ($event) => onDirect($event), keydown: ($event) => onDirectKeydown($event) }"
      />
      <uf-primary
        [href]="linked ? '#chained' : undefined"
        [text]="'Chained'"
        #chained
        [ufAttributes]="{ id: 'chained', 'aria-label': 'Chained', 'data-testid': 'chained' }"
        [ufListeners]="{ click: ($event) => onChained($event) }"
      />
      <button type="button" (click)="onToggle()">Toggle</button>
      <button type="button" (click)="onFocusDirect()">Focus direct</button>
      <button type="button" (click)="onFocusChained()">Focus chained</button>
      <ol aria-label="Log">
        @for (entry of log; track index; let index = $index) {
          <li>{{ entry }}</li>
        }
      </ol>
    </section>
  `,
})
export default class Page {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly directComponent = viewChild("direct", { read: Base });
  private readonly direct = computed<ElementRef<HTMLAnchorElement | HTMLButtonElement> | undefined>(
    () => this.directComponent()?.ufElement(),
  );
  private readonly chainedComponent = viewChild("chained", { read: Primary });
  private readonly chained = computed<
    ElementRef<HTMLAnchorElement | HTMLButtonElement> | undefined
  >(() => this.chainedComponent()?.ufElement());
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly linked = signal(true);
  protected readonly log = signal<string[]>([]);

  private record(line: string) {
    this.log.set([...this.log(), line]);
  }

  protected onDirect(event: PointerEvent) {
    this.record(`click on ${(event.currentTarget as Element).localName}`);
  }

  protected onDirectKeydown(event: KeyboardEvent) {
    this.record(`keydown ${event.key} on ${(event.currentTarget as Element).localName}`);
  }

  protected onChained(event: PointerEvent) {
    this.record(`chained on ${(event.currentTarget as Element).localName}`);
  }

  protected onToggle() {
    this.linked.set(!this.linked());
  }

  protected onFocusDirect() {
    this.direct()?.nativeElement.focus();
  }

  protected onFocusChained() {
    this.chained()?.nativeElement.focus();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
