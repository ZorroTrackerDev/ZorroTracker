import { ipcMain } from "electron";
import { log } from "./editor";
import { ipcEnum } from "./ipc enum";

/**
 * Handlers for forwarding console logs
 */
ipcMain.on(ipcEnum.ConsoleInfo, (event, ...data:unknown[]) => log.info(...data));
ipcMain.on(ipcEnum.ConsoleWarn, (event, ...data:unknown[]) => log.warn(...data));
ipcMain.on(ipcEnum.ConsoleError, (event, ...data:unknown[]) => log.error(...data));
