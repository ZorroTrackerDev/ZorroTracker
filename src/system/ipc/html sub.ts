import { ipcRenderer } from "electron";
import { ipcEnum } from "../../system/ipc/ipc enum";

// logging functions
window.ipc.log = {
	info: (...data:unknown[]) => ipcRenderer.send(ipcEnum.ConsoleInfo, ...["source", window.type, "::", ...data, ]),
	warn: (...data:unknown[]) => ipcRenderer.send(ipcEnum.ConsoleWarn, ...["source", window.type, "::", ...data, ]),
	error: (...data:unknown[]) => ipcRenderer.send(ipcEnum.ConsoleError, ...["source", window.type, "::", ...data, ]),
}
