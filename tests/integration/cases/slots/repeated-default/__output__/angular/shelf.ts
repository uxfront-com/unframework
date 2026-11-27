import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import EachAction, { EachActionDefault } from "./each-action";
import FadeFace, { FadeFaceDefault } from "./fade-face";
import FramedNote, { FramedNoteDefault } from "./framed-note";
import OnceAction from "./once-action";
import RowList, { RowListDefault } from "./row-list";
import TagList, { TagListDefault } from "./tag-list";
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
    RowListDefault,
    FramedNoteDefault,
    TagListDefault,
    EachActionDefault,
    FadeFaceDefault,
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
        <ng-template ufRowListDefault>
          <em>fresh</em>
        </ng-template>
      </uf-row-list>
      <uf-framed-note [title]="'Release notes'">
        <ng-template ufFramedNoteDefault>
          <strong>Draft</strong>
        </ng-template>
      </uf-framed-note>
      <uf-tag-list [ordered]="true" [label]="'Ranked'" [items]="['gold', 'silver']">
        <ng-template ufTagListDefault>
          <span>Medal</span>
        </ng-template>
      </uf-tag-list>
      <uf-tag-list [ordered]="false" [label]="'Unranked'" [items]="['red', 'blue']">
        <ng-template ufTagListDefault>
          <span>Colour</span>
        </ng-template>
      </uf-tag-list>
      <uf-once-action [href]="'#once'" [label]="'Once'">Open once</uf-once-action>
      <uf-once-action [label]="'Single'">Press once</uf-once-action>
      <uf-each-action [href]="'#each'" [items]="['one', 'two']">
        <ng-template ufEachActionDefault>Open each</ng-template>
      </uf-each-action>
      <uf-each-action [items]="['three', 'four']">
        <ng-template ufEachActionDefault>Press each</ng-template>
      </uf-each-action>
      <uf-fade-face [bold]="bold">
        <ng-template ufFadeFaceDefault>Face</ng-template>
      </uf-fade-face>
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
