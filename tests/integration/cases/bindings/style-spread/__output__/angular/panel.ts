import Hint from "./hint";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

type PanelLook = {
  borderColor?: string;
  borderStyle?: string;
  borderWidth?: string;
  "--panel-gap"?: string;
};

interface PanelAttributes {
  id: string;
  title?: string;
  style?: PanelLook;
}

interface NoteAttributes {
  title: string;
  style?: string;
}

export interface PanelProps {
  heading: string;
  panel: PanelAttributes;
  note?: NoteAttributes;
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
  selector: "uf-panel",
  imports: [Hint, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let heading = this.heading();
    @let panel = this.panel();
    @let note = this.note();
    <div class="panels" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <section [attr.id]="panel.id" [attr.title]="panel.title" [style]="panel.style" class="panel">
        <h2 style="margin-bottom: var(--panel-gap, 4px)">{{ heading }}</h2>
        <p [attr.title]="note?.title" [style]="note?.style">Changes save as you type.</p>
        <uf-hint
          [text]="'Saved a moment ago'"
          [attrs]="{ id: 'saved-hint', style: 'font-style: italic; color: rgb(90, 90, 90)' }"
          [style]="{ color: 'rgb(30, 90, 60)' }"
        />
      </section>
    </div>
  `,
})
export default class Panel {
  readonly heading = input.required<string>();
  readonly panel = input.required<PanelAttributes>();
  readonly note = input<NoteAttributes>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
