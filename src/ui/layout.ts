import { makeSlider, SliderEnum } from "./elements/slider/slider";

export async function editorLayout():Promise<void> {
	const body = document.getElementById("main_content");
	body?.appendChild(await volumeSlider());
}

async function volumeSlider():Promise<Element> {
	const limitVolume = (volume:number) => {
		return Math.max(0, Math.min(1, volume));
	}

	const convertVolume = (value:string, multiply:number) => {
		let volume:number|null = parseFloat(value);
		volume = isNaN(volume) ? null : volume * multiply;

		if(volume !== null) {
			volume = limitVolume(volume);
		}

		return volume;
	}

	const { element, setValue, } = makeSlider(SliderEnum.Horizontal | SliderEnum.Medium, {
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