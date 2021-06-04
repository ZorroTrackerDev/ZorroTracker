import { Project } from "../../misc/project";

export class ModuleSelect {
	public element:HTMLDivElement;
	private project:Project;

	constructor(project:Project) {
		this.project = project;

		// create the container div
		this.element = document.createElement("div");
		this.element.classList.add("moduleselect");

		// generate the inner HTML for each module
		let html = "";

		for(const m of project.modules) {
			html += /*html*/`
				<div>
					<div>${ m.index.toByte() }</div>
					<div>${ Project.typeString(m.type) }</div>
					<div>${ m.name }</div>
					<div>${ m.author }</div>
				</div>
			`;
		}

		// create the inner elements
		this.element.innerHTML = /*html*/`
			<div class="moduleselectheader">
				<div>#</div>
				<div>Type</div>
				<div>Module name</div>
				<div>Author</div>
			</div>

			<div class="moduleselectcontent">
				<div>${ html }</div>
			</div>

			<div class="moduleselectbuttons">
				<button>Add</button>
				<button>Clone</button>
				<button>Delete</button>
			</div>
		`;
	}
}