import { tooltipShortcutText } from "../../../api/dom";

const HEIGHT = 20+4+4;		// also defined in toolbar.less. Make sure to keep these in sync!

/*
 * this defines the window menu. Each item will be added to the top row.
 */
type ToolbarMenu = { [key: string]: ToolbarMenuEntry };
type ToolbarMenuEntry = {
	enabled?:boolean,
	action?: string,
	child?: ToolbarMenu,
	tooltip?: string,
	shortcut?: string,
};

const defaultMenu:ToolbarMenu = {
	"File": {
		enabled: true,
		child: {
			"VGM TEST": {
				enabled: true,
				action: "window.preload.vgm()",
				tooltip: "Open a VGM file for sound testing",
			},
			"New": {
				enabled: true,
				action: "window.preload.shortcut(['ui.new'])",
				shortcut: "ui.new",
				tooltip: "Create a blank project",
			},
			"Open": {
				enabled: true,
				action: "window.preload.shortcut(['ui.open'])",
				shortcut: "ui.open",
				tooltip: "Open a project file",
			},
			"Save": {
				enabled: true,
				action: "window.preload.shortcut(['ui.save'])",
				shortcut: "ui.save",
				tooltip: "Save project file to the current file",
			},
			"Save As": {
				enabled: true,
				action: "window.preload.shortcut(['ui.saveas'])",
				shortcut: "ui.saveas",
				tooltip: "Save the project file as a new file",
			},
			"Exit": {
				enabled: true,
				action: "window.ipc.ui.close()",
				tooltip: "Exit this application",
			},
		},
	},
	"Edit": {
		enabled: false,
		child: {
			"Undo": {
				enabled: true,
				action: "window.preload.shortcut(['ui.undo'])",
				shortcut: "ui.undo",
				tooltip: "Undo a change",
			},
			"Redo": {
				enabled: true,
				action: "window.preload.shortcut(['ui.redo'])",
				shortcut: "ui.redo",
				tooltip: "Redo a change",
			},
			"Cut": {
				enabled: true,
				action: "window.preload.shortcut([])",
			},
			"Copy": {
				enabled: true,
				action: "window.preload.shortcut([])",
			},
			"Paste": {
				enabled: true,
				action: "window.preload.shortcut([])",
			},
			"Project": {
				enabled: true,
				action: "window.preload.shortcut(['layout.open.projectinfo'])",
				shortcut: "layout.open.projectinfo",
				tooltip: "Open the project settings tab",
			},
			"Shortcuts": {
				enabled: true,
				action: "window.preload.shortcut(['layout.open.shortcuts'])",
				shortcut: "layout.open.shortcuts",
				tooltip: "Open the shortcuts tab",
			},
		},
	},
	"About": {
		enabled: true,
		child: {
			"Github": {
				enabled: true,
				action: "window.toolbarFunc.openGithub()",
				tooltip: "Open the project Github page",
			},
			"Discord": {
				enabled: true,
				action: "window.toolbarFunc.openDiscord()",
				tooltip: "Open the Discord server link for this project",
			},
		},
	},
};

/*
 * this defines the window buttons. These are just to control the program, just like windows programs are
 * (sorry linux and mac users - this will be sorted later!)
 */
type WindowButtons = { id: string, action: string, child: string }[];

const defaultButtons:WindowButtons = [
	{
		id: "main_toolbar_errors",
		action: "this.className = ''; window.ipc.ui.console()",
		child: /*html*/`
			<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" version="1.1">
				<circle cx="50" cy="50" r="30" stroke="#FF8080" stroke-width="8" fill="none" />
				<line x1="50" y1="30" x2="50" y2="55" stroke="#FF8080" stroke-width="8" stroke-linecap="butt" />
				<line x1="50" y1="61" x2="50" y2="70" stroke="#FF8080" stroke-width="8" stroke-linecap="butt" />
			</svg>
		`,
	},
	{
		id: "main_toolbar_minimize",
		action: "window.ipc.ui.minimize()",
		child: /*html*/`
			<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" version="1.1">
				<line x1="25%" y1="50%" x2="75%" y2="50%" stroke="white" stroke-width="10" stroke-linecap="butt" />
			</svg>
		`,
	},
	{
		id: "main_toolbar_maximize",
		action: "window.ipc.ui.maximize();",
		child: /*html*/`
			<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" version="1.1">
				<path fill="none" stroke="white" stroke-width="8" stroke-linecap="square"/>
			</svg>
		`,
	},
	{
		id: "main_toolbar_exit",
		action: "window.ipc.ui.close();",
		child: /*html*/`
			<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" version="1.1">
				<path fill="white" stroke="white" stroke-width="10" stroke-linecap="butt" d="
					M 25 25

					H 27
					L 50 50
					L 73 25
					H 75

					V 27
					L 50 50
					L 75 73
					V 75

					H 73
					L 50 50
					L 27 75
					H 25

					V 73
					L 50 50
					L 25 27
					V 25
					Z"/>
			</svg>
		`,
	},
];

/**
 * Creates a new toolbar menu and window buttons for the app.
 *
 * @param menu the `ToolbarMenu` instance that describes this toolbar.
 * @param buttons the `WindowButtons` array that contains the buttons to be added.
 * @returns HTML code that can be appended to the DOM
 */
export function makeToolbar(menu:ToolbarMenu, buttons:WindowButtons): string {
	// generate the window buttons here
	const buttonHTML = /*html*/`
		<div id='main_toolbar_controls'>
			${
				// convert every button into HTML and then merge it together
				buttons.map((button) => {
					return /*html*/`
						<div onclick="${button.action}" id="${button.id}">
							${button.child}
						</div>
					`;
				}).join("\n")
			}
		</div>
	`;

	// loop for each key in the "menu" object. This code will eventually generate the toolbar menu itself.
	const menuHTML = /*html*/`
		<div id='main_toolbar_menus'>
			${
				// convert every menu into HTML and then merge it together
				Object.keys(menu).map((key) => {
					// height of the dropdown menu in pixels.
					const height = (Object.keys(menu[key].child ?? {}).length * HEIGHT);

					return /*html*/`
						<button class='main_toolbar_dropdown' onclick='window.toolbarFunc.handleDropdown(this.children[1], event)'>
							<div class='main_toolbar_dropdown_text'>${ key }</div>
							<div class='main_toolbar_dropdown_content' style='height:${ height }px'>
								${ getDropdownMenu(menu[key]) }
							</div>
						</button>
					`;
				}).join("\n")
			}
		</div>
	`;

	return menuHTML +"<div id='main_toolbar_name'></div>"+ buttonHTML;
}

/**
 * function to generate HTML for a dropdown menu
 *
 * @param entry the entry in the `ToolbarMenu` that we want to generate dropdown menu HTML for.
 */
function getDropdownMenu(entry:ToolbarMenuEntry) {
	// TODO: entry.enabled is ignored!
	let html = "";

	// run through every object in the array. If this field was not specified, use {} as a shorthand for 0 items.
	for(const name in entry.child ?? {}) {
		// typescript is not smart enough to notice that we actually can't get an undefined object here.
		const item = (entry.child as ToolbarMenu)[name];

		// load tooltip text
		const tooltipText = tooltipShortcutText(item.tooltip, item.shortcut);

		// create the final shortcut text
		const tooltip = tooltipText.length === 0 ? "" : "title=\""+ tooltipText +"\"";

		html += /* html */`
			<div class='main_toolbar_dropdown_item' ${ tooltip } onclick="${
				// if this has an action, enable the onclick handler, otherwise do nothing
				item.action ? item.action : ""
			};window.toolbarFunc.handleDropdown(this.parentNode, event)" >
				${name}
			</div>
		`;

		// TODO: we're ignoring entry.child.child!
	}

	return html;
}

/**
 * function tocreate the default toolbar
 *
 * @param menu Whether to create the menu as well
 */
export function loadDefaultToolbar(menu:boolean): void {
	try {
		// find the DOM element for the toolbar
		const toolbarDiv = document.getElementById("main_toolbar");

		if(toolbarDiv){
			// note: only calculating the toolbar if the element exists!
			toolbarDiv.innerHTML = makeToolbar(menu ? defaultMenu : {}, defaultButtons);
			window.ipc.ui.updateMaximized();
		}

	} catch(ex) {
		// TODO: handle errors
	}
}

// the classnamve for the active class used by the dropdown menu
const activeClass = "active";

/**
 * Hide every dropdown menu currently active
 *
 * @param event if this was invoked via `document.onclick`, this will be the event object
 */
function hideDropdownMenus(event?:Event) {
	event?.preventDefault();

	// deactivate all other dropdown menus
	const menuButtons = document.getElementById("main_toolbar_menus")?.children;

	for(let i = 0;i < (menuButtons ? menuButtons.length : 0);i ++){
		// Checks if this is a menu button. typescript is not smart enough to realize this can't be null or undefined.
		if((menuButtons as HTMLCollection)[i].classList.contains("main_toolbar_dropdown")) {
			// remove the active class (even if it doesn't have that)
			(menuButtons as HTMLCollection)[i].children[1].classList.remove(activeClass);
		}
	}

	// remove the "hideDropdownMenus" event handler from document
	document.removeEventListener("click", hideDropdownMenus);
}

/**
 * Function to set the window title attribute
 *
 * @param title The title text
 */
export function setTitle(title:string):void {
	// set the title on taskbar
	document.title = title;

	// load the toolbar title attribute
	const e = document.getElementById("main_toolbar_name");

	if(e) {
		// if found, set it too
		e.innerText = title;
	}
}

// add helper functions here
window.toolbarFunc = {
	/**
	 * handle the dropdown menu interactions correctly.
	 *
	 * @param element the target element that will be acted upon
	 * @param event the event that triggered this interaction
	 * @returns false
	 */
	handleDropdown: (element:Element, event:Event) => {
		// this prevents the document click handler from getting the click event.
		event.preventDefault();
		event.stopPropagation();

		if(element.classList.contains(activeClass)) {
			// menu is already active, remove the active class
			element.classList.remove(activeClass);

			// also remove the "hideDropdownMenus" handler from document
			document.removeEventListener("click", hideDropdownMenus);

		} else {
			// menu is already active, hide the dropdown menus and add the active class
			hideDropdownMenus();
			element.classList.add(activeClass);

			// also add the "hideDropdownMenus" handler to document
			document.addEventListener("click", hideDropdownMenus);
		}

		return false;
	},

	/**
	 * Helper function to open the Github repository in an external browser.
	 */
	openGithub: () => {
		window.ipc.ui.openInBrowser("https://github.com/ZorroTrackerDev/ZorroTracker");
	},

	/**
	 * Helper function to open the Discord server link in an external browser.
	 */
	openDiscord: () => {
		window.ipc.ui.openInBrowser("https://discord.gg/VhR3kwtZ5r");
	},
};
