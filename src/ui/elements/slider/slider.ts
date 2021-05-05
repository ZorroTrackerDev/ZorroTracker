export enum SliderEnum {
	// slider directions
	Vertical = 0x100, Horizontal = 0x000,

	// slider sizes
	Small = 0x00, Medium = 0x01, Large = 0x02,
}

type SliderFunctions = {
	getValue:(value:number) => number,
	getValueOffset:(value:number, offset:number) => number,
	toText:(value:number) => string,
	fromText:(value:string) => number|null,
};

type SliderReturn = {
	element: Element,
	setValue:(value:number) => void,
};

export function makeSlider(type:SliderEnum, functions:SliderFunctions):SliderReturn {
	const { getValue, getValueOffset, toText, fromText, } = functions;
	const e = document.createElement("div");
	e.classList.add("slider");

	// get size
	switch(type & 0xFF) {
		case SliderEnum.Small:	e.classList.add("slider_small"); break;
		case SliderEnum.Medium:	e.classList.add("slider_medium"); break;
		case SliderEnum.Large:	e.classList.add("slider_large"); break;
	}

	// get direction
	switch(type & 0xF00) {
		case SliderEnum.Vertical:	e.classList.add("slider_vertical"); break;
		case SliderEnum.Horizontal:	e.classList.add("slider_horizontal"); break;
	}

	e.innerHTML = /*html*/`
		<div class="slider_text">
			<div class="slider_icon">🔊</div>
			<textarea class="slider_value" rows="1" wrap="off"></textarea>
		</div>
		<div class="slider_bar">
			<div>
				<button></button>
			</div>
		</div>
	`;

	const barNode = e.children[1] as HTMLElement;
	const ballNode = barNode.children[0] as HTMLElement;
	const textNode = (e.children[0] as Element).children[1] as HTMLTextAreaElement;
	let timeout:NodeJS.Timeout|null = null;
	let lastValue = 0;

	const _edit = (value:number|null, transition:boolean) => {
		const start = textNode.selectionStart, end = textNode.selectionEnd, len = textNode.value.length;

		if(value !== null){
			ballNode.classList.add("animate");

			if(timeout){
				clearTimeout(timeout);
			}

			if(transition) {
				timeout = setTimeout(() => ballNode.classList.remove("animate"), 300);

			} else {
				ballNode.classList.remove("animate");
			}

			_set(value);

		} else {
			_set(lastValue);
		}

		if(start === len && end === len){
			textNode.selectionStart = textNode.value.length;
			textNode.selectionEnd = textNode.value.length;

		} else {
			textNode.selectionStart = start;
			textNode.selectionEnd = end;
		}
	}

	const _text = () => _edit(fromText(textNode.value), true);

	const arrow = (up:boolean) => {
		// find if there is a . in here
		const dot = textNode.value.indexOf(".");
		const low = dot && textNode.selectionStart > dot;

		_edit(getValueOffset(lastValue, ((up ? 1 : -1) * (low ? 0.1 : 1))), false);
	}

	textNode.onblur = _text;
	textNode.onkeydown = function(event:KeyboardEvent) {
		switch(event.keyCode) {
			case 13: // Enter
				event.preventDefault();
				_text();
				return false;

			case 38: // Arrow up
			event.preventDefault();
				arrow(true);
				return false;

			case 40: // Arrow down
				event.preventDefault();
				arrow(false);
				return false;
		}
	}

	const mouseup = () => {
		document.onmousemove = null;
		document.onmouseup = null;
	}

	const _set = (value:number) => {
		const position = getValue(value);
		lastValue = position;
		ballNode.style.left = (position * 100) +"%";
		textNode.value = toText(position);
	}

	const mousemove = (event:MouseEvent) => {
		const rect = barNode.getBoundingClientRect();
		let position = 0;

		switch(type & 0xF00) {
			case SliderEnum.Vertical:	position = (event.clientY - rect.top) / rect.height; break;
			case SliderEnum.Horizontal:	position = (event.clientX - rect.left) / rect.width; break;
		}

		if(position < 0) {
			position = 0;

		} else if(position > 1) {
			position = 1;
		}

		_set(position);
	}

	barNode.onmousedown = function(event) {
		event.preventDefault();

		// enable mouse events
		document.onmousemove = mousemove;
		document.onmouseup = mouseup;
		mousemove(event);
	}

	return { element: e, setValue: _set, };
}