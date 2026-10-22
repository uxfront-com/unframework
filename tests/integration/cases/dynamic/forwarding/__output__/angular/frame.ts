import Card, { CardTitle } from "./card";
import Panel, { PanelTitle } from "./panel";
import { NgTemplateOutlet } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  TemplateRef,
  contentChild,
  inject,
  input,
} from "@angular/core";

/** A template of `Frame`'s `title` slot, which takes no `let-` variable (ADR-0056). */
@Directive({ selector: "ng-template[ufFrameTitle]" })
export class FrameTitle {
  static ngTemplateContextGuard(
    _directive: FrameTitle,
    _context: unknown,
  ): _context is Record<never, never> {
    return true;
  }
}

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
  selector: "uf-frame",
  imports: [Panel, Card, PanelTitle, CardTitle, NgTemplateOutlet, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let wide = this.wide();
    <section
      class="frame"
      [attr.aria-label]="label"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      @switch (wide ? "Panel" : "Card") {
        @case ("Panel") {
          <uf-panel>
            @if (this.titleTemplate(); as template) {
              <ng-template ufPanelTitle>
                <ng-container [ngTemplateOutlet]="template" />
              </ng-template>
            }
          </uf-panel>
        } @case ("Card") {
          <uf-card>
            @if (this.titleTemplate(); as template) {
              <ng-template ufCardTitle>
                <ng-container [ngTemplateOutlet]="template" />
              </ng-template>
            }
          </uf-card>
        }
      }
    </section>
    <ng-content select="[ufFrameTitle]" />
  `,
})
export default class Frame {
  readonly label = input.required<string>();
  readonly wide = input.required<boolean>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly titleTemplate = contentChild(FrameTitle, { read: TemplateRef });
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
