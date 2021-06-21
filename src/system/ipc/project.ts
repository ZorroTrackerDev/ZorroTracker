import { ipcMain } from "electron";
import { WindowType } from "../../defs/windowtype";
import { windows } from "../../main";
import { ipcEnum } from "./ipc enum";

// handle loading project details
ipcMain.on(ipcEnum.ProjectInit, (event, type:WindowType, config:unknown, modules:unknown) => {
	if(type === WindowType.Editor) {
		// editor -> children
		windows[WindowType.ProjectInfo]?.webContents.send(ipcEnum.ProjectInit, config, modules);

	} else {
		// children -> editor
		windows[WindowType.Editor].webContents.send(ipcEnum.ProjectInit);
	}
});
