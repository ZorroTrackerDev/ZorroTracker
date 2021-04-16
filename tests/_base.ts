import { Application } from "spectron";
import electron from "electron";

export let app:Application;

beforeAll(async(done) => {
	try {
		process.env.NODE_ENV = "test";

		// this is valid somehow
		app = new Application({
			//@ts-ignore
			path: electron,
			args: [ ".", ],
			chromeDriverArgs: [
				"headless",
				"disable-gpu",
				"window-size=800,600",
				"no-sandbox",
				"whitelisted-ips=",
				"disable-dev-shm-usage",
			],
		});

		await app.start();

	} catch(ex) {
		console.log(ex);
	}

	done();
}, 1000*10);

afterAll(async(done) => {
	try {
		if (app && app.isRunning()) {
			await app.stop();
		}

	} catch(ex) {
		console.log(ex);
	}

	done();
}, 1000*10);