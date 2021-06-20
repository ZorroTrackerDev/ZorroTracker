import fs from "fs";
import path from "path";
import { ZorroEvent, ZorroEventEnum } from "../../api/events";
import { WindowType } from "../../defs/windowtype";

/**
 * Magical function that allows us to run custom code before calling different console functions. This is highly hacky. Sorry not sorry.
 *
 * @param method The name of the method to intercept
 * @param func The extra function to run before calling the original function
 */
function intercept(method:string, func:(...args:unknown[]) => void){
	// @ts-ignore
	// eslint-disable-next-line @typescript-eslint/ban-types
	const original = console[method] as Function;

	// @ts-ignore
	console[method] = function(...args:unknown[]) {
		func(...args);
		original.apply(console, args);
	};
}

if(window.type !== WindowType.Editor) {
	// add the log functions
	intercept("log", (...args:unknown[]) => window.ipc.log?.info(...args));
	intercept("info", (...args:unknown[]) => window.ipc.log?.info(...args));
	intercept("warn", (...args:unknown[]) => window.ipc.log?.warn(...args));

	intercept("error", (...args:unknown[]) => {
		window.ipc.log?.error(...args);

		// add the error class to this object
		document.getElementById("main_toolbar_errors")?.classList.add("error");
	});

} else {
	// helper function to write strings to the output file
	let _write:(text:string) => void = () => {};

	// generate the log path
	const logPath = process.platform === "darwin" ?
		path.join(window.path.home, "/Library/Logs/ZorroTracker.log") :	// macos logging path
		path.join(window.path.data, "ZorroTracker.log");				// windows and linux logging path

	fs.open(logPath, "w", (err, fd) => {
		if(err){
			console.error("Can not open logging file!", err);
		}

		// function to write logging data
		_write = (text:string) => {
			fs.write(fd, text, (err) => {
				if(err){
					// disable the _write maco on failure
					_write = () => {};
					console.error("Can not write logging file!", err);
				}
			});
		}

		// close the logging file when the program is closed
		ZorroEvent.addListener(ZorroEventEnum.Exit, () => {
			return new Promise((res) => {
				// try to write the exit event to log
				console.info("app-request-exit");

				// maybe probably closes the file
				fs.close(fd, () => res());
			});
		});

		// request info dump
		window.ipc.ui.systemInfo();
	});

	/**
	 * Function to write standard logging style output to file
	 *
	 * @param prefix The prefix name of the log
	 * @param args The console.xyz arguments to use
	 */
	const _log = (prefix:string, ...args:unknown[]) => {
		// convert arguments to string and then join them together
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const _out = args.map((v:Error|any) =>
			v === null ? "<null>" :					// special case for nulls
			v === undefined ? "<undefined>" :		// special case for undefined
			(v instanceof Error) ? v.stack :		// special case for any Error
			v.toString()							// transform anything else to a string
		).join(" ");

		// write it to the log file
		_write(`[${new Date().toISOString()}][${prefix}] ${_out}${_out.indexOf("\n") >= 0 ? "\n" : ""}\n`);
	}

	// add the log functions
	intercept("log", (...args:unknown[]) => _log("INFO", ...args));
	intercept("info", (...args:unknown[]) => _log("INFO", ...args));
	intercept("warn", (...args:unknown[]) => _log("WARN", ...args));

	intercept("error", (...args:unknown[]) => {
		_log("ERROR", ...args);

		// add the error class to this object
		document.getElementById("main_toolbar_errors")?.classList.add("error");
	});
}
