import { PatternEditor } from "./elements/patterneditor/main";
import { volumeSlider, simpleSlider, SliderEnum } from "./elements/slider/slider";

export async function editorLayout():Promise<void> {
	const body = document.getElementById("main_content");

	if(!body){
		throw new Error("Failed to initialize editorLayout");
	}

	/**
	 * -------------------------------------
	 * patterns        | settings
	 * -------------------------------------
	 * tracker editor
	 * -------------------------------------
	 */

	const _top = document.createElement("div");
	_top.id = "editor_top";
	body.appendChild(_top);

	_top.appendChild(new PatternEditor().element)

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
