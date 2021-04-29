export {};

declare global {
	export interface Window {
		exports: unknown,
		preload: {
			close: () => void,
			minimize: () => void,
			maximize: () => void,
			openInBrowser: (url:string) => void,
			updateMaximizeButtonState: () => void,
			open: () => void,
		},
		toolbarFunc: {
			handleDropdown (element:Element, event:Event): void,
			openGithub: () => void,
		}
	}
}