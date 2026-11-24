import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Bio from "./bio";
import NameField from "./name-field";
import { Component, ElementRef, computed, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-profile",
  imports: [NameField, Bio, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <form
      aria-label="Profile"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-name-field #name [label]="'Name'" />
      <button type="button" (click)="onEditName()">Edit name</button>
      <uf-bio #bio [label]="'Bio'" />
      <button type="button" (click)="onEditBio()">Edit bio</button>
    </form>
  `,
})
export default class Profile {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly nameComponent = viewChild("name", { read: NameField });
  private readonly name = computed<ElementRef<HTMLInputElement> | undefined>(() =>
    this.nameComponent()?.ufElement(),
  );
  private readonly bioComponent = viewChild("bio", { read: Bio });
  private readonly bio = computed<ElementRef<HTMLInputElement> | undefined>(() =>
    this.bioComponent()?.ufElement(),
  );
  readonly ufElement = viewChild<ElementRef<HTMLFormElement>>("ufElement");

  protected onEditName() {
    this.name()?.nativeElement.focus();
  }

  protected onEditBio() {
    this.bio()?.nativeElement.focus();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
