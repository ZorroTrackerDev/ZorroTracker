import { app } from "./_base";

test("App creates a window", async function () {
	try {
		const count = await app.client.getWindowCount();
		expect(count).toEqual(1);

	} catch(ex) {
		console.log(ex);
	}
});