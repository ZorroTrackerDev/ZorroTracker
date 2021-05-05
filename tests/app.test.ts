import { Application } from "spectron";
import { getApp, closeApp } from "./_base";

let app:Application;

beforeAll(async(done) => {
	try {
		app = await getApp();

	} catch(ex) {
		console.log(ex);
	}

	done();
}, 1000*10);

afterAll(async(done) => {
	try {
		await closeApp(app);

	} catch(ex) {
		console.log(ex);
	}

	done();
}, 1000*10);

test("App creates a window", async function () {
	try {
		const count = await app.client.getWindowCount();
		expect(count).toEqual(1);

	} catch(ex) {
		console.log(ex);
	}
});