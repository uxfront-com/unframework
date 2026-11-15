import { VRecord } from "./v-record";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  signal,
} from "@angular/core";

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
}

@Component({
  selector: "uf-meter",
  imports: [ScopeAttributes, VRecord],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let level = this.level();
    @let renders = this.renders();
    <section
      class="meter"
      aria-label="Meter"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <output class="level" [vRecord]="level">Level {{ level }}</output>
      <p>Rendered again {{ renders }} times</p>
      <button type="button" (click)="onRaise()">Raise</button>
      <button type="button" (click)="onRenderAgain()">Render again</button>
    </section>
  `,
})
export default class Meter {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly level = signal(1);
  protected readonly renders = signal(0);

  protected onRaise() {
    this.level.update((level) => level + 1);
  }

  protected onRenderAgain() {
    this.renders.update((renders) => renders + 1);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
