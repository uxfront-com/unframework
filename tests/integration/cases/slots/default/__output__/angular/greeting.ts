import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Panel from "./panel";
import { Component, ElementRef, computed, inject, input, viewChild } from "@angular/core";

/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

@Component({
  selector: "uf-greeting",
  imports: [Panel, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    <uf-panel
      [title]="'Welcome'"
      [class]="this.class()"
      [style]="this.style()"
      [ufAttributes]="this.ufAttributes()"
      [ufListeners]="this.ufListeners()"
      [ufScope]="this.host"
      #ufElement
    >
      <p>Hello, <strong>{{ name }}</strong>!</p>
      <p>Your children render in the panel.</p>
    </uf-panel>
  `,
})
export default class Greeting {
  readonly name = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly rootComponent = viewChild("ufElement", { read: Panel });
  readonly ufElement = computed(() => this.rootComponent()?.ufElement());
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
