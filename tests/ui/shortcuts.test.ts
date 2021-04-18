/**
 * @jest-environment jsdom
 */

import { addShortcuts, loadDefaultShortcuts } from "../../ui/misc/shortcuts";

test("Can load test shortcuts", function () {
	expect(() =>
		addShortcuts({
			"testname1": [ "F12", "CTRL+F12", "ShiFt+alt+F12", ],
			"testname2": "ALT+A",
			"testname3": [],
			"testname4": [ "SHIFT+ALT+CTRL+ESC", ],
		})
	).not.toThrow();
});

test("Invalid shortcut in addShortcuts fails", function () {
	expect(() => addShortcuts({
		"testname1": [ "", ],
	})).toThrow();
});

test("Can load default shortcut", function () {
	expect(() => loadDefaultShortcuts()).not.toThrow();
});