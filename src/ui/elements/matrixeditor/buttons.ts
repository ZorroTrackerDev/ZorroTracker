import { ZorroEvent, ZorroEventEnum, ZorroEventObject } from "../../../api/events";
import { Matrix } from "../../../api/matrix";
import { Tab } from "../../misc/tab";
import { MatrixEditor, editMode } from "./main";

/**
 * Helper type declarations for the buttons below
 */
export type PatternIndexEditorButtonList = {
	class: string[],
	items: PatternIndexEditorButton[],
};

export type PatternIndexEditorButton = {
	tooltip: string,
	shortcut?: string,
	svg: string,
	click?: (edit:MatrixEditor, event:MouseEvent) => unknown,
	load?: (element:HTMLDivElement, edit:MatrixEditor) => unknown,
};

/**
 * All the different standard buttons for controlling the pattern editor. This also has the functionality of these buttons.
 */
export const standardButtons:PatternIndexEditorButtonList[] = [
	{
		class: [ "matrixbutton", ],
		items: [
			{
				svg: /*html*/`
					<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
						<path stroke="#000" stroke-width="10" d="
							M 50 8
							V 92
							M 8 50
							H 92
						"/>
					</svg>
				`,
				tooltip: "Increment digit",
				shortcut: "layout.patternindex.change.up",
				click: (edit:MatrixEditor, event:MouseEvent):void => {
					if(edit.mode !== editMode.Paste) {
						edit.change(1, event.button === 0).catch(console.error);
					}
				},
			},
			{
				svg: /*html*/`
					<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
						<path stroke="#000" stroke-width="10" d="
							M 12 50
							H 88
						"/>
					</svg>
				`,
				tooltip: "Decrement digit",
				shortcut: "layout.patternindex.change.down",
				click: (edit:MatrixEditor, event:MouseEvent):void => {
					if(edit.mode !== editMode.Paste) {
						edit.change(-1, event.button === 0).catch(console.error);
					}
				},
			},
		],
	},
	{
		class: [ "text", "matrixsize", "transparent", ],
		items: [
			{
				svg: "<div>Matrix: </div>00",
				tooltip: "",
			},
		],
	},
	{
		class: [ "matrixbutton", ],
		items: [
			{
				svg: /*html*/`
					<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
						<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" d="
							M 50 92
							H 12
							V 8
							H 88
							V 55

							M 50 72
							L 69 92
							L 88 72

							M 69 92
							V 50
						"/>
					</svg>
				`,
				tooltip: "Insert at selection",
				shortcut: "layout.patternindex.insert",
				click: (edit:MatrixEditor, event:MouseEvent):void => {
					if(event.button === 0 && edit.mode !== editMode.Paste) {
						edit.insert().catch(console.error);
					}
				},
			},
			{
				svg: /*html*/`
					<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
						<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" d="
							M 30 8
							H 88
							V 80

							M 50 20
							H 15
							V 92
							H 75
							V 45
							L 50 20
							V 45
							H 75
						"/>
					</svg>
				`,
				tooltip: "Copy selection into clipboard",
				shortcut: "layout.patternindex.copy",
				click: (edit:MatrixEditor, event:MouseEvent):void => {
					if(event.button === 0 && edit.mode !== editMode.Paste) {
						edit.copy().catch(console.error);
					}
				},
			},
			{
				svg: /*html*/`
					<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
						<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" d="
							M 27 20
							H 17
							V 92
							H 83
							V 20
							H 73

							M 67 32
							H 33
							V 16
							H 40
							Q 50,3 60,16
							H 67
							V 32

							M 32 45
							H 68

							M 32 60
							H 68

							M 32 75
							H 68
						"/>
					</svg>
				`,
				tooltip: "Paste pattern data from clipboard",
				shortcut: "layout.patternindex.pasteenter",
				click: (edit:MatrixEditor, event:MouseEvent):void => {
					if(event.button === 0 && edit.mode !== editMode.Paste) {
						edit.pasteInit().catch(console.error);
					}
				},
			},
			{
				svg: /*html*/`
					<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
						<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" d="
							M 20 25
							V 82
							Q 20,92 30,92
							H 70
							Q 80,92 80,82
							V 25

							M 90 25
							H 10

							M 30 25
							L 38 8
							H 62
							L 70 25

							M 37 40
							V 75

							M 50 40
							V 75

							M 63 40
							V 75
						"/>
					</svg>
				`,
				tooltip: "Delete at selection",
				shortcut: "layout.patternindex.delete",
				click: (edit:MatrixEditor, event:MouseEvent):void => {
					if(event.button === 0 && edit.mode !== editMode.Paste) {
						edit.delete().catch(console.error);
					}
				},
			},
		],
	},
	{
		class: [ "text", "matrixsize", ],
		items: [
			{
				svg: "",
				tooltip: "The matrix length",
				load: (element:HTMLDivElement):void => {
					// update the matrix resize element
					_matrixResize = element;

					// apply the text first time
					element.innerHTML = "<div>Matrix: </div>"+ ((Tab.active?.matrix.getHeight() ?? 1) - 1).toByte();
				},
			},
		],
	},
	{
		class: [ "matrixbutton", ],
		items: [
			{
				svg: /*html*/`
					<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
						<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" d="
							M 35 22
							V 55
							H 12
							L 50 92
							L 88 55
							H 65
							V 22
							Z

							M 20 8
							H 80
						"/>
					</svg>
				`,
				tooltip: "Move selection down",
				shortcut: "layout.patternindex.shiftdown",
				click: (edit:MatrixEditor, event:MouseEvent):void => {
					if(event.button === 0 && edit.mode !== editMode.Paste) {
						edit.shiftDown().catch(console.error);
					}
				},
			},
			{
				svg: /*html*/`
					<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
						<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" d="
							M 35 78
							V 45
							H 12
							L 50 8
							L 88 45
							H 65
							V 78
							Z

							M 20 92
							H 80
						"/>
					</svg>
				`,
				tooltip: "Move selection up",
				shortcut: "layout.patternindex.shiftup",
				click: (edit:MatrixEditor, event:MouseEvent):void => {
					if(event.button === 0 && edit.mode !== editMode.Paste) {
						edit.shiftUp().catch(console.error);
					}
				},
			},
		],
	},
];

/**
 * All the different paste buttons for controlling the pattern editor. This also has the functionality of these buttons.
 */
 export const pasteButtons:PatternIndexEditorButtonList[] = [
	{
		class: [ "matrixbutton", "center", ],
		items: [
			{
				svg: /*html*/`
					<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
						<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" d="
							M 15 15
							L 85 85

							M 85 15
							L 15 85
						"/>
					</svg>
				`,
				tooltip: "Cancel the paste action",
				shortcut: "layout.patternindex.pasteexit",
				click: (edit:MatrixEditor, event:MouseEvent):void => {
					if(event.button === 0 && edit.mode === editMode.Paste) {
						edit.pasteExit().catch(console.error);
					}
				},
			},
			{
				svg: /*html*/`
					<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
						<path stroke="#000" fill="none" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" d="
							M 80 25
							L 45 80
							L 20 60
						"/>
					</svg>
				`,
				tooltip: "Apply the paste area",
				shortcut: "layout.patternindex.edit",
				click: (edit:MatrixEditor, event:MouseEvent):void => {
					if(event.button === 0 && edit.mode === editMode.Paste) {
						edit.pasteApply().catch(console.error);
					}
				},
			},
		],
	},
];

let _matrixResize:HTMLDivElement|undefined;

/**
 * Helper event listener for the MatrixResize event, so that the text element can be updated with correct number
 */
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.MatrixResize, async(event:ZorroEventObject, index:Matrix, size:number) => {
	if(_matrixResize) {
		_matrixResize.innerHTML = "<div>Matrix: </div>"+ (size - 1).toByte();
	}
});
