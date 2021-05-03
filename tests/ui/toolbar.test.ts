/**
 * @jest-environment jsdom
 */
import { loadDefaultToolbar } from "../../src/ui/elements/toolbar/toolbar";

test("Creating the default toolbar works", function () {
	expect(() => loadDefaultToolbar()).not.toThrow();
});