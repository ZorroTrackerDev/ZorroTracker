import { simpleSlider, SliderEnum } from "./elements/slider/slider";

export async function editorLayout():Promise<void> {
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

	const body = document.getElementById("main_content");
	body?.appendChild(getspace());
	body?.appendChild(await volumeSlider(SliderEnum.Horizontal | SliderEnum.Medium));

	body?.appendChild(document.createElement("br"));
	body?.appendChild(getspace());
	body?.appendChild(btn("FM1", "window.ipc.chip.muteFM(0, this.checked)"));
	body?.appendChild(btn("FM2", "window.ipc.chip.muteFM(1, this.checked)"));
	body?.appendChild(btn("FM3", "window.ipc.chip.muteFM(2, this.checked)"));
	body?.appendChild(btn("FM4", "window.ipc.chip.muteFM(3, this.checked)"));
	body?.appendChild(btn("FM5", "window.ipc.chip.muteFM(4, this.checked)"));
	body?.appendChild(btn("FM6", "window.ipc.chip.muteFM(5, this.checked)"));
	body?.appendChild(btn("DAC", "window.ipc.chip.muteFM(6, this.checked)"));

	body?.appendChild(document.createElement("br"));
	body?.appendChild(getspace());
	body?.appendChild(btn("PSG1", "window.ipc.chip.mutePSG(0, this.checked)"));
	body?.appendChild(btn("PSG2", "window.ipc.chip.mutePSG(1, this.checked)"));
	body?.appendChild(btn("PSG3", "window.ipc.chip.mutePSG(2, this.checked)"));
	body?.appendChild(btn("PSG4", "window.ipc.chip.mutePSG(3, this.checked)"));
}

async function volumeSlider(type:SliderEnum):Promise<Element> {
	const { element, setValue, label, } = simpleSlider(type, 200, 2000, 1, "%", (volume:number) => {
		window.ipc.audio.volume(volume / 100);
		window.ipc.cookie.set("main_volume", volume +"");

		if(volume > 100) {
			label.innerText = "📣";

		} else if(volume > 50){
			label.innerText = "🔊";

		} else if(volume > 0){
			label.innerText = "🔉";

		} else {
			label.innerText = "🔈";
		}

		label.style.width = "1.3em";
	});

	const cookie = await window.ipc.cookie.get("main_volume") ?? "";
	setValue(cookie, 0.25);
	return element;
}