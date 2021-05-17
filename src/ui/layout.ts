import { PatternIndex } from "../api/pattern";
import { UIShortcutHandler } from "../api/ui";
import { PatternIndexEditor } from "./elements/patterneditor/main";
import { volumeSlider, SliderEnum } from "./elements/slider/slider";
import { addShortcutReceiver } from "./misc/shortcuts";

export class _Temp implements UIShortcutHandler {
	public patternIndex:PatternIndexEditor|undefined;

	public receiveShortcut(data: string[]): boolean {
		switch(data.shift()) {
			case "patternindex":
				return this.patternIndex?.receiveShortcut(data) ?? false;
		}

		return false;
	}
}

export const _temp = new _Temp();

export async function editorLayout():Promise<void> {
	const body = document.getElementById("main_content");

	if(!body){
		throw new Error("Failed to initialize editorLayout");
	}

	/**
	 * -------------------------------------
	 * pattern index     | settings
	 * -------------------------------------
	 * pattern edit
	 * -------------------------------------
	 */

	const _top = document.createElement("div");
	_top.id = "editor_top";
	body.appendChild(_top);

	// initialize the pattern index. TODO: Driver-dependant behavior
	const index = new PatternIndex([ "FM1", "FM2", "FM3", "FM4", "FM5", "FM6", "PCM", "PSG1", "PSG2", "PSG3", "PSG4", ]);
	_top.appendChild((_temp.patternIndex = new PatternIndexEditor(index)).element);
	addShortcutReceiver("layout", (data) => _temp.receiveShortcut(data));

	const _bot = document.createElement("div");
	_bot.id = "editor_bottom";
	body.appendChild(_bot);

	const getspace = () => {
		const space = document.createElement("div");
		space.style.width = "20px";
		space.style.display = "inline-block";
		return space;
	}

	const btn = (text:string, event:string) => {
		const b = document.createElement("label");
		b.innerHTML = /*html*/`
			<input type="checkbox" onchange="${event}" />
			${text}
		`;
		return b;
	};

	_top.appendChild(getspace());
	_top.appendChild(await volumeSlider(SliderEnum.Horizontal | SliderEnum.Medium));

	_top.appendChild(document.createElement("br"));
	_top.appendChild(getspace());
	_top.appendChild(btn("FM1", "window.ipc.chip.muteFM(0, this.checked)"));
	_top.appendChild(btn("FM2", "window.ipc.chip.muteFM(1, this.checked)"));
	_top.appendChild(btn("FM3", "window.ipc.chip.muteFM(2, this.checked)"));
	_top.appendChild(btn("FM4", "window.ipc.chip.muteFM(3, this.checked)"));
	_top.appendChild(btn("FM5", "window.ipc.chip.muteFM(4, this.checked)"));
	_top.appendChild(btn("FM6", "window.ipc.chip.muteFM(5, this.checked)"));
	_top.appendChild(btn("DAC", "window.ipc.chip.muteFM(6, this.checked)"));

	_top.appendChild(document.createElement("br"));
	_top.appendChild(getspace());
	_top.appendChild(btn("PSG1", "window.ipc.chip.mutePSG(0, this.checked)"));
	_top.appendChild(btn("PSG2", "window.ipc.chip.mutePSG(1, this.checked)"));
	_top.appendChild(btn("PSG3", "window.ipc.chip.mutePSG(2, this.checked)"));
	_top.appendChild(btn("PSG4", "window.ipc.chip.mutePSG(3, this.checked)"));
}
