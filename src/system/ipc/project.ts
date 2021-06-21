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
		windows[WindowType.Editor]?.webContents.send(ipcEnum.ProjectInit);
	}
});

// handle updating project name
ipcMain.on(ipcEnum.ProjectSetName, (event, name:string) => windows[WindowType.Editor]?.webContents.send(ipcEnum.ProjectSetName, name));

// handle updating project driver
ipcMain.on(ipcEnum.ProjectSetDriver, (event, uuid:string) => windows[WindowType.Editor]?.webContents.send(ipcEnum.ProjectSetDriver, uuid));

// handle selecting another module
// eslint-disable-next-line max-len
ipcMain.on(ipcEnum.ProjectSelectModule, (event, index:number) => windows[WindowType.Editor]?.webContents.send(ipcEnum.ProjectSelectModule, index));

// handle updating module config
// eslint-disable-next-line max-len
ipcMain.on(ipcEnum.ProjectSetModule, (event, data:unknown) => windows[WindowType.Editor]?.webContents.send(ipcEnum.ProjectSetModule, data));

// handle adding a new module
ipcMain.on(ipcEnum.ProjectAddModule, (event, file:string) => windows[WindowType.Editor]?.webContents.send(ipcEnum.ProjectAddModule, file));

// handle adding a new module
ipcMain.on(ipcEnum.ProjectDeleteModule, (event, index:number) => windows[WindowType.Editor]?.webContents.send(ipcEnum.ProjectDeleteModule, index));

// handle cloning a module
ipcMain.on(ipcEnum.ProjectCloneModule, (event, index:number) => windows[WindowType.Editor]?.webContents.send(ipcEnum.ProjectCloneModule, index));
