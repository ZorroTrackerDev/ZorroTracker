export enum ipcEnum {
	UiPath = "ui-path",
	UiOpenURL = "ui-openurl",
	UiSystemInfo = "ui-sysinfo",
	UiGetMaximize = "ui-getmaximize",
	UiMaximize = "ui-maximize",
	UiMinimize = "ui-minimize",
	UiClose = "ui-close",
	UiZoomIn = "ui-zoomin",
	UiZoomOut = "ui-zoomout",
	UiZoomSet = "ui-zoomset",
	UiExit = "ui-exit",
	UiDevTools = "ui-devtools",
	UiInspectElement = "ui-inspectelement",
	UiConsole = "ui-console",
	UiDialog = "ui-dialog",
	UiLoadWindow = "ui-window",

	ConsoleInfo = "console-info",
	ConsoleWarn = "console-warn",
	ConsoleError = "console-error",

	RpcInit = "rpc-init",
	RpcSet = "rpc-set",

	CookieSet = "cookie-set",
	CookieGet = "cookie-get",

	LogInfo = "log-info",
	LogWarn = "log-warn",
	LogError = "log-error",

	AudioCreate = "audio-create",
	AudioClose = "audio-close",
	AudioVolume = "audio-volume",
	AudioPlay = "audio-play",
	AudioStop = "audio-stop",

	DriverFindAll = "driver-findall",

	ChipFindAll = "chip-findall",
	ChipMuteFM = "chip-mutefm",
	ChipMutePSG = "chip-mutepsg",

	ProjectInit = "project-init",
	ProjectSetName = "project-set-name",
	ProjectSetDriver = "project-set-driver",
	ProjectSetModule = "project-set-module",
	ProjectAddModule = "project-add-module",
	ProjectDeleteModule = "project-del-module",
	ProjectCloneModule = "project-clone-module",
	ProjectSelectModule = "project-select-module",
}
