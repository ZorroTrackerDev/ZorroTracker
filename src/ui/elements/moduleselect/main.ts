import { ipcRenderer } from "electron";
import { ZorroEvent, ZorroEventEnum, ZorroEventObject } from "../../../api/events";
import { ipcEnum } from "../../../system/ipc/ipc enum";
import { Module, Project } from "../../misc/project";
import { confirmationDialog, PopupColors, PopupSizes } from "../popup/popup";

export class ModuleSelect {
	public element:HTMLDivElement;
	private project:Project;
	private items:HTMLDivElement;
	private buttons:HTMLDivElement;
	private selection:HTMLDivElement|undefined;

	constructor(project:Project) {
		this.project = project;

		// create the container div
		this.element = document.createElement("div");
		this.element.classList.add("moduleselect");
		_moduleselect = this;

		// create the inner elements
		this.element.innerHTML = /*html*/`
			<div class="moduleselectheader">
				<div>#</div>
				<div>Type</div>
				<div>Module name</div>
				<div>Author</div>
			</div>

			<div class="moduleselectcontent">
				<div></div>
			</div>

			<div class="moduleselectbuttons">
				<button>Create</button>
				<button>Clone</button>
				<button>Delete</button>
			</div>
		`;

		// update elements
		this.items = (this.element.children[1] as HTMLDivElement).children[0] as HTMLDivElement;
		this.buttons = this.element.children[2] as HTMLDivElement;

		// prepare stuff
		this.renderAllItems();
		this.setEventListeners();

		// set button event listeners for each button
		for(let i = this.buttonFunc.length - 1;i >= 0; --i) {
			(this.buttons.children[i] as HTMLButtonElement).onclick = (event:MouseEvent) => {
				try {
					return this.buttonFunc[i](event, this);

				} catch(ex) {
					console.error(ex);
				}
			};
		}

		// re-select the current module
		project.setActiveModuleIndex(false).catch(console.error);
	}

	private buttonFunc = [
		async(e:MouseEvent, m:ModuleSelect) => {		// create
			// create a new module and get its index
			const mod = m.project.addModule();
			const index = m.project.getModuleIndexByFile(mod.file);
			console.log("create!!!", mod, index)

			// render the new module
			m.items.innerHTML += m.renderItem(index);

			// set it as the active module
			await m.project.setActiveModuleIndex(false, index);

			// reset event listeners
			m.setEventListeners();

			// let the editor window know
			ipcRenderer.send(ipcEnum.ProjectAddModule, mod.file);
		},
		async(e:MouseEvent, m:ModuleSelect) => {		// clone
			if(m.project.activeModuleIndex >= 0) {
				const clone = m.project.modules[m.project.activeModuleIndex];

				// create a new module and get its index
				const mod = await m.project.addModule();
				const index = m.project.getModuleIndexByFile(mod.file);

				// clone the module
				await m.project.cloneModule(clone, mod);

				// render the new module
				m.items.innerHTML += m.renderItem(index);

				// let the editor window know
				ipcRenderer.send(ipcEnum.ProjectCloneModule, m.project.activeModuleIndex);

				// set it as the active module
				await m.project.setActiveModuleIndex(false, index);

				// tell the editor to change to this module
				ipcRenderer.send(ipcEnum.ProjectSelectModule, m.project.activeModuleIndex);

				// reset event listeners
				m.setEventListeners();
			}
		},
		async(e:MouseEvent, m:ModuleSelect) => {		// delete
			if(m.project.activeModuleIndex >= 0) {
				// get the module index
				const index = m.project.activeModuleIndex;

				// make sure the user wanted to delete this
				if(!await confirmationDialog({
					color: PopupColors.Normal,
					size: PopupSizes.Small,
					html: /*html*/`
						<h2>Are you sure you want to permanently delete this module?</h2>
						<p>
							You're about to delete <q>${ m.project.modules[index].name }</q>.
							You can not recover this module if you do. Click <u>Delete</u> to delete it permanently!
						</p>
					`, buttons: [
						{ result: false, float: "left", color: PopupColors.Normal, html: "Cancel", },
						{ result: true, float: "right", color: PopupColors.Caution, html: "Delete", },
					],
				})) {
					return;
				}

				// copy the selection before deletion
				const _sel = m.selection;

				// delete the actual module
				if(await m.project.deleteModule(index)){
					// let the editor window know
					ipcRenderer.send(ipcEnum.ProjectDeleteModule, index);

					// tell the editor to change to this module
					ipcRenderer.send(ipcEnum.ProjectSelectModule, m.project.activeModuleIndex);

					if(_sel) {
						// if successful, remove the element
						m.items.removeChild(_sel);

						// check if no more modules exist
						if(m.project.modules.length === 0) {
							// force-enable the empty tag
							m.items.innerHTML = "";

						} else {
							// plz reselect
							m.setSelection(m.project.activeModuleIndex);
						}
					}

					// update event listeners
					m.setEventListeners();
				}
			}
		},
	];

	/**
	 * Helper function to render a all items as HTML
	 */
	private renderAllItems() {
		this.items.innerHTML = this.project.modules.map((v, ix) => this.renderItem(ix)).join("");
	}

	/**
	 * Helper function to render a single item as HTML
	 *
	 * @param index Index of the item to render
	 * @returns HTML representing the item requested
	 */
	private renderItem(index:number) {
		return /*html*/`
			<div ${ this.project.activeModuleIndex === index ? "class='"+ ModuleSelect.SELECT_CLASS +"'" : "" }>
				${ this.renderItemInner(index) }
			</div>
		`;
	}

	/**
	 * Helper function to render a single item's inner elements as HTML
	 *
	 * @param index Index of the item to render
	 * @returns HTML representing the item requested
	 */
	private renderItemInner(index:number) {
		return /*html*/`
			<div>${ this.project.modules[index].index.toByte() }</div>
			<div>${ Project.typeString(this.project.modules[index].type) }</div>
			<div>${ this.project.modules[index].name }</div>
			<div>${ this.project.modules[index].author }</div>
		`;
	}

	/**
	 * Helper function to render an item into the HTML
	 *
	 * @param index Index of the item to render
	 */
	public renderIndex(index:number):void {
		// check that the index is valid
		if(index >= 0 && index < this.items.children.length) {
			// re-render the item content
			this.items.children[index].innerHTML = this.renderItemInner(index);
		}
	}

	// constant for the selected class
	private static readonly SELECT_CLASS = "selected";

	/**
	 * Select a module as the currently module in the project
	 *
	 * @param index Index of the item to select
	 */
	public setSelection(index:number): void {
		// check that the index is valid
		if(index >= 0 && index < this.items.children.length) {
			// yes - clear the entire selection first
			this.clearSelection();

			// select the single item that was requested
			this.selection = this.items.children[index] as HTMLDivElement;
			this.selection.classList.add(ModuleSelect.SELECT_CLASS);

		} else {
			this.selection = undefined;
		}
	}

	/**
	 * Helper function to remove the selected class from every item
	 */
	private clearSelection() {
		for(let i = this.items.children.length - 1;i >= 0; --i) {
			this.items.children[i].classList.remove(ModuleSelect.SELECT_CLASS);
		}
	}

	/**
	 * Function to update onclick listeners for each event
	 */
	private setEventListeners() {
		// loop for each element giving them an onclick listener
		for(let i = this.items.children.length - 1;i >= 0; --i) {
			(this.items.children[i] as HTMLDivElement).onclick = async(event:MouseEvent) => {

				// select this index when clicked
				if(await this.project.setActiveModuleIndex(false, i)) {
					// if successful, set the selected element too
					this.selection = (event.currentTarget as HTMLDivElement) ?? undefined;

					// tell the editor to change to this module
					ipcRenderer.send(ipcEnum.ProjectSelectModule, i);
				}
			}
		}
	}
}

let _moduleselect: ModuleSelect|undefined;

/**
 * Helper event listener for the SelectModule event, so that the selection can be updated
 */
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.SelectModule, async(event:ZorroEventObject, project:Project|undefined, module:Module|undefined) => {
	if(_moduleselect && project && module) {
		// load the module index that is selected
		const ix = project.getModuleIndexByFile(module.file);

		// select it on both ui and project
		_moduleselect.setSelection(ix);
	}
});

/**
 * Helper event listener for the ModuleUpdate event, so that the modules can be edited in the UI
 */
// eslint-disable-next-line require-await
ZorroEvent.addListener(ZorroEventEnum.ModuleUpdate, async(event:ZorroEventObject, project:Project, module:Module) => {
	if(_moduleselect) {
		// load the module index that is selected
		const ix = project.getModuleIndexByFile(module.file);

		// render this specific module item
		_moduleselect.renderIndex(ix);
	}
});
