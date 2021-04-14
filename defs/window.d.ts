export {};

declare global {
	export interface Window {
		preload: {
			close: () => void,
			minimize: () => void,
			maximize: () => void,
			openInBrowser: (url:string) => void,
		},
		toolbarFunc: {
			dropdown: (element:Element, e:Event) => void,
			openGithub: () => void,
		}
	}
}