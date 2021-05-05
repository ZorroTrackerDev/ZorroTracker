import { Application } from "spectron";
import electron from "electron";

const allApps:Application[] = [];

export async function getApp():Promise<Application> {
	process.env.NODE_ENV = "test";

	// this is valid somehow
	const app = new Application({
		//@ts-ignore
		path: electron,
		args: [ ".", ],
		port: 9515 + allApps.length,
		chromeDriverArgs: [
			"headless",
			"disable-gpu",
			"window-size=800,600",
			"no-sandbox",
			"whitelisted-ips=",
			"disable-dev-shm-usage",
		],
	});

	allApps.push(app);
	await app.start();
	return app;
}

export async function closeApp(app:Application):Promise<void> {
	if (app && app.isRunning()) {
		await app.stop();
	}
}