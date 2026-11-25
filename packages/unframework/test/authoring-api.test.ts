import { describe, expect, it } from "vitest";

import * as api from "../src/index.ts";
import * as devRuntime from "../src/jsx-dev-runtime.ts";
import * as runtime from "../src/jsx-runtime.ts";

/** The runtime surface of `@uxfront/unframework`: plan §4.2, nothing more (everything else is a type). */
const AUTHORING_API = [
	"Teleport",
	"Transition",
	"computed",
	"defineDirective",
	"defineEmits",
	"defineExpose",
	"defineModel",
	"defineOptions",
	"defineSlots",
	"inject",
	"nextTick",
	"onMounted",
	"onUnmounted",
	"provide",
	"ref",
	"useId",
	"useTemplateRef",
	"watch",
	"watchEffect",
];

/**
 * The constants beside the functions: `isDev` (ADR-0117), which the compiler replaces with each
 * framework's own development check, so uncompiled code reads it as a development build would.
 */
const AUTHORING_CONSTANTS = ["isDev"];

describe("the authoring API", () => {
	it("exports exactly the plan's functions and constants at runtime", () => {
		expect(Object.keys(api).toSorted()).toEqual(
			[...AUTHORING_API, ...AUTHORING_CONSTANTS].toSorted(),
		);
	});

	it("exports `isDev` as `true`, as a development build reads it uncompiled", () => {
		expect(api.isDev).toBe(true);
	});

	it.each(AUTHORING_API)("%s throws when it runs uncompiled, naming itself", (name) => {
		const stub = (api as unknown as Record<string, () => unknown>)[name]!;
		expect(stub).toThrow(
			new Error(
				`unframework: \`${name}\` is compile-time only. This module was not compiled by ` +
					"unframework (is the .uf.tsx file going through the unframework bundler plugin?).",
			),
		);
	});
});

describe("the JSX runtime entries", () => {
	it("are types only: the compiler lowers JSX, so nothing imports a value from them", () => {
		expect(Object.keys(runtime)).toEqual([]);
		expect(Object.keys(devRuntime)).toEqual([]);
	});
});
