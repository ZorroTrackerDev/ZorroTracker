const HEIGHT = 18+4+4;		// also defined in toolbar.less. Make sure to keep these in sync!

window.onload = function() {
	/** code to generate the dropdown menus, using the "menus" variable.
	 * format is as follows:
	 * <div class='main_toolbar_dropdown' onclick='[toggle dropdown menu]'>
	 *     <div class='main_toolbar_dropdown_text'>[item name]</div>
	 *     <div class='main_toolbar_dropdown_content' style='height:[height of the menu ((number of items * HEIGHT) + 5)]'>
	 *         <div class='main_toolbar_dropdown_item' onclick='[run function in item] + [toggle dropdown menu]'>
	 *             [item name]
	 *        </div>
	 *     </div>
	 * </div>
	 * */
	let data = "";

	for(const x of Object.keys(menus)) {
		data += "<div class='main_toolbar_dropdown' onclick='window.toolbarFunc.dropdown(this.children[1], event)'>";
		data += "<div class='main_toolbar_dropdown_text'>"+ x +"</div>";
		data += "<div class='main_toolbar_dropdown_content' style='height:"+ ((Object.keys(menus[x]).length * HEIGHT) + 5) +"px'>";
		
		for(const y of Object.keys(menus[x])) {
			data += "<div class='main_toolbar_dropdown_item' onclick='"+ menus[x][y] +";window.toolbarFunc.dropdown(this.parentNode, event)'>"+ y +"</div>";
		}

		data += "</div></div>";
	}

	/** code to generate the window buttons, using the "buttons" variable.
	 * format is as follows:
	 * <div class='main_toolbar_controls'>
	 *     <div onclick='[run function in item]'>[item name]</div>
	 * </div>
	 * */
	data += "<div id='main_toolbar_controls'>";
	for(const x of Object.keys(buttons)) {
		data += "<div onclick='"+ buttons[x] +"'><span>"+ x +"</span></div>";
	}

	data += "</div>";

	// set as toolbar content
	const toolbar = document.getElementById("main_toolbar");
	toolbar && (toolbar.innerHTML = data);
}

// helper function to hide all dropdown menus when anything outside of it is clicked, or a dropdown was activated
const _c = "_active";

function hideAll(e?:Event) {
	e?.preventDefault();

	// deactivate all other dropdown menus
	const x = document.getElementById("main_toolbar")?.children;

	for(let i = 0;i < (x ? x.length : 0);i ++){
		if((x as HTMLCollection)[i].classList.contains("main_toolbar_dropdown")) {
			// remove the _active class (even if it doesn't have that)
			(x as HTMLCollection)[i].children[1].classList.remove(_c);
		}
	}

	// remove the hideall event handler
	document.removeEventListener("click", hideAll);
}

// add helper functions here
window.toolbarFunc = {
	dropdown: (element:Element, e:Event) => {
		// DO NOT call the document click handler this time
		e.preventDefault();
		e.stopPropagation();

		if(element.classList.contains(_c)) {
			// menu already active: deactivate
			element.classList.remove(_c);

			// remove the hideall event handler
			document.removeEventListener("click", hideAll);

		} else {
			// menu not active: activate
			hideAll();
			element.classList.add(_c);

			// add the hideall event handler
			document.addEventListener("click", hideAll);
		}

		return false;
	},
	openGithub: () => {
		window.preload.openInBrowser('https://github.com/ZorroTrackerDev/ZorroTracker');
	}
};

/** this defines the window menu. Each item will be added to the top row.
 * top-level item = item in the toolbar
 * second-level item = item that will appear in the dropdown menu for the toolbar item
 * the code inside second-level item will appear as the onclick handler
 */
const menus: { [key: string]: { [key: string]: string|{ [key: string]: string } }; } = {
	"File": {
		"Exit": "window.preload.close()",
	},
	"Edit": {

	},
	"About": {
		"Github": "window.toolbarFunc.openGithub()",
	},
};

/** this defines the window buttons. These are just to control the program, just like windows programs are (sorry linux and mac users - this will be sorted later!)
 * each entry is just the name (icon) of the entry, and the value is the onclick handler code
 */
const buttons: { [key: string]: string } = {
	"-": "window.preload.minimize()",
	"□": "window.preload.maximize()",
	"x": "window.preload.close()",
};