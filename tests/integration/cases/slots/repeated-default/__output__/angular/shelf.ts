import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import EachAction from "./each-action";
import FadeFace from "./fade-face";
import FramedNote from "./framed-note";
import OnceAction from "./once-action";
import RowList from "./row-list";
import TagList from "./tag-list";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-shelf",
  imports: [
    RowList,
    FramedNote,
    TagList,
    OnceAction,
    EachAction,
    FadeFace,
    ScopeAttributes,
    Fallthrough,
  ],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let bold = this.bold();
    <section
      class="shelf"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-row-list [label]="'Produce'" [items]="['Apples', 'Pears', 'Plums']">
        <em>fresh</em>
      </uf-row-list>
      <uf-framed-note [title]="'Release notes'">
        <strong>Draft</strong>
      </uf-framed-note>
      <uf-tag-list [ordered]="true" [label]="'Ranked'" [items]="['gold', 'silver']">
        <span>Medal</span>
      </uf-tag-list>
      <uf-tag-list [ordered]="false" [label]="'Unranked'" [items]="['red', 'blue']">
        <span>Colour</span>
      </uf-tag-list>
      <uf-once-action [href]="'#once'" [label]="'Once'">Open once</uf-once-action>
      <uf-once-action [label]="'Single'">Press once</uf-once-action>
      <uf-each-action [href]="'#each'" [items]="['one', 'two']">Open each</uf-each-action>
      <uf-each-action [items]="['three', 'four']">Press each</uf-each-action>
      <uf-fade-face [bold]="bold">Face</uf-fade-face>
      <button type="button" (click)="onSwapFace()">Swap face</button>
    </section>
  `,
})
export default class Shelf {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly bold = signal(true);

  protected onSwapFace() {
    this.bold.set(!this.bold());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
