import { makeSlider, SliderEnum } from "./elements/slider/slider";

export async function editorLayout():Promise<void> {
	const getspace = () => {
		const space = document.createElement("div");
		space.style.width = "20px";
		space.style.display = "inline-block";
		return space;
	}

	const body = document.getElementById("main_content");
	body?.appendChild(getspace());
	body?.appendChild(await volumeSlider(SliderEnum.Horizontal | SliderEnum.Large));
	body?.appendChild(document.createElement("br"));
	body?.appendChild(document.createElement("br"));
	body?.appendChild(getspace());
	body?.appendChild(await volumeSlider(SliderEnum.Horizontal | SliderEnum.Medium));
	body?.appendChild(document.createElement("br"));
	body?.appendChild(document.createElement("br"));
	body?.appendChild(getspace());
	body?.appendChild(await volumeSlider(SliderEnum.Horizontal | SliderEnum.Small));
	body?.appendChild(document.createElement("br"));
	body?.appendChild(document.createElement("br"));


	body?.appendChild(getspace());
	body?.appendChild(await volumeSlider(SliderEnum.Vertical | SliderEnum.Large));
	body?.appendChild(getspace());
	body?.appendChild(await volumeSlider(SliderEnum.Vertical | SliderEnum.Medium));
	body?.appendChild(getspace());
	body?.appendChild(await volumeSlider(SliderEnum.Vertical | SliderEnum.Small));
}

async function volumeSlider(type:SliderEnum):Promise<Element> {
	const limitVolume = (volume:number) => {
		return Math.round(Math.max(0, Math.min(1, volume)) * 2000) / 2000;
	}

	const convertVolume = (value:string, multiply:number) => {
		let volume:number|null = parseFloat(value);
		volume = isNaN(volume) ? null : volume * multiply;

		if(volume !== null) {
			volume = limitVolume(volume);
		}

		return volume;
	}

	const { element, setValue, label, } = makeSlider(type, {
		toText: (value) => {
			return (value * 200).toFixed(1) +"%";
		},
		fromText: (value:string) => {
			const volume = value.substring(0, value.length - (value.endsWith("%") ? 1 : 0));
			return convertVolume(volume, 1 / 200);
		},
		getValue: (value:number) => {
			const volume = limitVolume(value);
			window.ipc.audio.volume(volume * 2);
			window.ipc.cookie.set("main_volume", volume +"");

			if(volume > 0.5) {
				label.innerText = "📣";

			} else if(volume > 0.25){
				label.innerText = "🔊";

			} else if(volume > 0){
				label.innerText = "🔉";

			} else {
				label.innerText = "🔈";
			}

			label.style.width = "1.3em";

			return volume;
		},
		getValueOffset: (value:number, offset:number) => {
			return value + (offset / 200);
		},
	});

	const cookie = await window.ipc.cookie.get("main_volume") ?? "";
	setValue(convertVolume(cookie, 1) ?? 0.25);

	return element;
}