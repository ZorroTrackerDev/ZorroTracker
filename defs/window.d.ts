export {};

declare global {
	export interface Window {
		preload: {
			close: () => void,
			minimize: () => void,
			maximize: () => void,
			openInBrowser: (url:string) => void,
			updateMaximizeButtonState: () => void,
		},
		toolbarFunc: {
			handleDropdown (element:Element, event:Event): void,
			openGithub: () => void,
		}
	}
}