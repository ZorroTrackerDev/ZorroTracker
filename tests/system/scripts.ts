/**
 * @jest-environment jsdom
 */
import { Application } from "spectron";
import { getApp, closeApp } from "../_base";

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


// helper function to get the chip
async function _getchip() {
	const res = await app.client.execute(() => {
		return window.ipc.chip.findAll();
	});

	// Note: Special UUID for Nuked
	return res["9d8d2954-ad94-11eb-8529-0242ac130003"];
}

// helper function to get the driver
async function _getdriver() {
	const res = await app.client.execute(() => {
		return window.ipc.driver.findAll();
	});

	// Note: Special UUID for Nuked
	return res["9d8d267a-ad94-11eb-8529-0242ac130003"];
}

test("Nuked chip exists", function () {
	return expect(new Promise((res, rej) => {
		_getchip().then((cfg) => res(typeof cfg.name)).catch(rej);

	})).resolves.toBe("string");
});

test("VGM driver exists", function () {
	return expect(new Promise((res, rej) => {
		_getdriver().then((cfg) => res(typeof cfg.name)).catch(rej);

	})).resolves.toBe("string");
});

test("Able to initialize driver and chip", function () {
	// eslint-disable-next-line no-async-promise-executor
	return expect(new Promise(async(res, rej) => {
		app.client.execute((chip, driver) => {
			window.ipc.audio.init(chip, driver);
			window.ipc.audio.play();
			window.ipc.audio.stop();
			window.ipc.audio.close();

		}, await _getchip(), await _getdriver()).then(res).catch(rej);
	})).resolves.not.toThrow();
});