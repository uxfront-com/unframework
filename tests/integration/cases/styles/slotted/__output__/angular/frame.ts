import { NgTemplateOutlet } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  TemplateRef,
  ViewEncapsulation,
  contentChild,
  inject,
  input,
} from "@angular/core";

/** What a template of `Frame`'s `label` slot reads: the slot's props. */
export type FrameLabelContext = { text: string };

/** A template of `Frame`'s `label` slot, its `let-` variables typed (ADR-0056). */
@Directive({ selector: "ng-template[ufFrameLabel]" })
export class FrameLabel {
  static ngTemplateContextGuard(
    _directive: FrameLabel,
    _context: unknown,
  ): _context is FrameLabelContext & { $implicit: FrameLabelContext } {
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
  imports: [NgTemplateOutlet, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <figure
      class="frame"
      [class]="this.class()"
      [style]="this.style()"
      data-uf-9dc516fd=""
      [ufScope]="this.host"
    >
      <ng-content />
      @if (this.labelTemplate(); as template) {
        <ng-container
          [ngTemplateOutlet]="template"
          [ngTemplateOutletContext]="{ $implicit: { text: 'Harbour at dusk' }, text: 'Harbour at dusk' }"
        />
      }
    </figure>
    <ng-content select="[ufFrameLabel]" />
  `,
  styleUrl: "./Frame.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Frame {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly labelTemplate = contentChild(FrameLabel, { read: TemplateRef });
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
