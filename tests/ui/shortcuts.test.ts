/**
 * @jest-environment jsdom
 */

// NOTE: fs relies on being in the correct directory!!
process.chdir("src");
import { addShortcuts, loadDefaultShortcuts } from "../../src/ui/misc/shortcuts";

beforeAll(() => {
	window.path = "./";
});

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