import { Module, ModuleData, Project } from "../ui/misc/project";
import { PatternIndex } from "./matrix";
import { ClipboardType } from "./ui";

/**
 * Class that holds all the events and their listeners
 */
export class ZorroEvent {
	// list of all the events registered
	private static events:ZorroEvent[] = [];

	/**
	 * Function to create and event and assign it to the caller
	 *
	 * @param name The enum representing the event we're about to register
	 * @returns Functions for firing events that validate who is the owner
	 */
	public static createEvent<E extends ZorroEventListenerHelper>(name: E): ZorroSenderTypes[E] {
		// if event didn't exist before, create it
		if(!ZorroEvent.events[name]){
			ZorroEvent.events[name] = new ZorroEvent(name);
		}

		/**
		 * Function to call the event handlers and return a boolean on whether the event was cancelled
		 *
		 * @param args The arguments for the event call
		 */
		return (...args:unknown[]) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return ZorroEvent.events[name].send(args) as any;
		}
	}

	/**
	 * Add an event listener to an event
	 *
	 * @param name name of the event
	 * @param func The function to execute for the event
	 */
	public static addListener<E extends ZorroEventSenderHelper>(name:E, func:ZorroListenerTypes[E]):void {
		// if event didn't exist before, create it
		if(!ZorroEvent.events[name]){
			ZorroEvent.events[name] = new ZorroEvent(name);
		}

		// if the listener was not found, add it to the list
		if(!ZorroEvent.events[name].listeners.includes(func as ZorroListener)){
			ZorroEvent.events[name].listeners.push(func as ZorroListener);
		}
	}

	/**
	 * Remove an event listener from an event
	 *
	 * @param name name of the event
	 * @param func The function to remove from the event
	 */
	public static removeListener<E extends ZorroEventSenderHelper>(name:E, func:ZorroListenerTypes[E]):void {
		// if event didn't exist before, create it
		if(!ZorroEvent.events[name]){
			return;
		}

		// check if the listener is in the list
		const index = ZorroEvent.events[name].listeners.indexOf(func as ZorroListener);

		if(index >= 0){
			// remove it from the list
			ZorroEvent.events[name].listeners.splice(index);
		}
	}

	/**
	 * Creates a new ZorroEvent instance
	 *
	 * @param name The name of the ZorroEvent
	 */
	private constructor(name:ZorroEventEnum) {
		this.name = name;
		this.listeners = [];
	}

	// the name of the current event
	private name:ZorroEventEnum;

	/**
	 * Creates a new ZorroEvent instance
	 *
	 * @param name The name of the ZorroEvent
	 * @returns true if event was not cancelled, false if it was
	 */
	private async send(args:unknown[]) {
		const _event = new ZorroEventObject();
		let _value = undefined;

		// run through all the listeners
		for(const fn of this.listeners){
			const r = await fn(_event, ...args);

			// if value was set, update _value
			if(r !== undefined) {
				_value = r;
			}

			// run the next function.
			if(_event.canceled) {
				// event was cancelled by function, return immediately
				return { event: _event, value: _value, };
			}
		}

		// was not cancelled
		return { event: _event, value: _value, };
	}

	// list of all the event listeners
	private listeners:ZorroListener[];
}

/**
 * The function type for ZorroTracker listeners
 */
export type ZorroListener = (event:ZorroEventObject, ...args:unknown[]) => Promise<unknown>;

/**
 * Enum that holds all the names for the events
 */
export enum ZorroEventEnum {
	Exit,							// event that is ran when the program is trying to exit
	ClipboardSet,					// event that is ran when the clipboard is set to a custom value (for example, does not apply to text boxes)
	ClipboardGet,					// event that is ran when the clipboard is being fetched for custom value (again, does not apply to text boxes)

	ProjectOpen,					// event that is ran when a project is opened or created
	SelectModule,					// event that is ran when a module is selected (as the active module)
	ModuleUpdate,					// event that is ran when a module information is updated (such as its name)
	ModuleCreate,					// event that is ran when a new module will be created
	ModuleDelete,					// event that is ran when a module will be deleted

	MatrixSet,						// event that is ran when matrix data is going to be set
	MatrixGet,						// event that is ran when matrix data is going to be fetched
	MatrixResize,					// event that is ran when the matrix is going to be resized
	MatrixInsert,					// event that is ran when a row will be inserted to the matrix
	MatrixRemove,					// event that is ran when a row will be removed from the matrix

	PatternTrim,					// event that is ran when a pattern will be trimmed
	PatternMake,					// event that is ran when a new pattern will be created

	MidiNoteOn,						// event that is ran when a MIDI note is triggered
	MidiNoteOff,					// event that is ran when a MIDI note is released
}

/**
 * Helper for function calls
 */
type ZorroEventListenerHelper = keyof ZorroListenerTypes;
type ZorroEventSenderHelper = keyof ZorroSenderTypes;

/**
 * Helper object to allow various acitons on events, cancellation for example
 */
 export class ZorroEventObject {
	private _canceled = false;

	/**
	 * Cancel the events, the caller will not execute the code that was requested, other events will not run.
	 */
	public cancel():void {
		this._canceled = true;
	}

	/** If true, the event was canceled */
	public get canceled():boolean {
		return this._canceled;
	}
}

/**
 * Different listener function types. Event listeners expects to use the following functions
 */
/* eslint-disable max-len*/
export interface ZorroListenerTypes {
	[ZorroEventEnum.Exit]: (event:ZorroEventObject) => Promise<undefined|void>,
	[ZorroEventEnum.ClipboardGet]: (event:ZorroEventObject, type:ClipboardType) => Promise<string|undefined|void>,
	[ZorroEventEnum.ClipboardSet]: (event:ZorroEventObject, type:ClipboardType, data:string) => Promise<string|undefined|void>,

	[ZorroEventEnum.ProjectOpen]: (event:ZorroEventObject, project:Project|undefined) => Promise<undefined|void>,
	[ZorroEventEnum.SelectModule]: (event:ZorroEventObject, project:Project, module:Module|undefined, data:ModuleData|undefined) => Promise<undefined|void>,
	[ZorroEventEnum.ModuleUpdate]: (event:ZorroEventObject, project:Project, module:Module, data:ModuleData|null) => Promise<undefined|void>,
	[ZorroEventEnum.ModuleCreate]: (event:ZorroEventObject, project:Project, module:Module, data:ModuleData) => Promise<undefined|void>,
	[ZorroEventEnum.ModuleDelete]: (event:ZorroEventObject, project:Project, module:Module, data:ModuleData) => Promise<undefined|void>,

	[ZorroEventEnum.MatrixSet]: (event:ZorroEventObject, index:PatternIndex, channel:number, row:number, value:number) => Promise<number|undefined|void>,
	[ZorroEventEnum.MatrixGet]: (event:ZorroEventObject, index:PatternIndex, channel:number, row:number, value:number) => Promise<number|undefined|void>,
	[ZorroEventEnum.MatrixResize]: (event:ZorroEventObject, index:PatternIndex, height:number, width:number) => Promise<undefined|void>,
	[ZorroEventEnum.MatrixInsert]: (event:ZorroEventObject, index:PatternIndex, row:number, data:Uint8Array) => Promise<undefined|void>,
	[ZorroEventEnum.MatrixRemove]: (event:ZorroEventObject, index:PatternIndex, row:number) => Promise<undefined|void>,

	[ZorroEventEnum.PatternTrim]: (event:ZorroEventObject, index:PatternIndex, channel:number, position:number) => Promise<undefined|void>,
	[ZorroEventEnum.PatternMake]: (event:ZorroEventObject, index:PatternIndex, channel:number, position:number) => Promise<undefined|void>,

	[ZorroEventEnum.MidiNoteOn]: (event:ZorroEventObject, channel:number, note:number, velocity:number) => Promise<undefined|void>,
	[ZorroEventEnum.MidiNoteOff]: (event:ZorroEventObject, channel:number, note:number, velocity:number) => Promise<undefined|void>,
}

/**
 * Different sender function types. Each emitter expects to use the following functions
 */
export interface ZorroSenderTypes {
	[ZorroEventEnum.Exit]: () => Promise<{ event: ZorroEventObject, value: undefined }>,
	[ZorroEventEnum.ClipboardGet]: (type:ClipboardType) => Promise<{ event: ZorroEventObject, value: string|undefined }>,
	[ZorroEventEnum.ClipboardSet]: (type:ClipboardType, data:string) => Promise<{ event: ZorroEventObject, value: string|undefined }>,

	[ZorroEventEnum.ProjectOpen]: (project:Project|undefined) => Promise<{ event: ZorroEventObject, value: undefined }>,
	[ZorroEventEnum.SelectModule]: (project:Project, module:Module|undefined, data:ModuleData|undefined) => Promise<{ event: ZorroEventObject, value: undefined }>,
	[ZorroEventEnum.ModuleUpdate]: (project:Project, module:Module, data:ModuleData|null) => Promise<{ event: ZorroEventObject, value: undefined }>,
	[ZorroEventEnum.ModuleCreate]: (project:Project, module:Module, data:ModuleData) => Promise<{ event: ZorroEventObject, value: undefined }>,
	[ZorroEventEnum.ModuleDelete]: (project:Project, module:Module, data:ModuleData) => Promise<{ event: ZorroEventObject, value: undefined }>,

	[ZorroEventEnum.MatrixSet]: (index:PatternIndex, channel:number, row:number, value:number) => Promise<{ event: ZorroEventObject, value: number|undefined }>,
	[ZorroEventEnum.MatrixGet]: (index:PatternIndex, channel:number, row:number, value:number) => Promise<{ event: ZorroEventObject, value: number|undefined }>,
	[ZorroEventEnum.MatrixResize]: (index:PatternIndex, height:number, width:number) => Promise<{ event: ZorroEventObject, value: undefined }>,
	[ZorroEventEnum.MatrixInsert]: (index:PatternIndex, row:number, data:Uint8Array) => Promise<{ event: ZorroEventObject, value: undefined }>,
	[ZorroEventEnum.MatrixRemove]: (index:PatternIndex, row:number) => Promise<{ event: ZorroEventObject, value: undefined }>,

	[ZorroEventEnum.PatternTrim]: (index:PatternIndex, channel:number, position:number) => Promise<{ event: ZorroEventObject, value: undefined }>,
	[ZorroEventEnum.PatternMake]: (index:PatternIndex, channel:number, position:number) => Promise<{ event: ZorroEventObject, value: undefined }>,

	[ZorroEventEnum.MidiNoteOn]: (channel:number, note:number, velocity:number) => Promise<{ event: ZorroEventObject, value: undefined }>,
	[ZorroEventEnum.MidiNoteOff]: (channel:number, note:number, velocity:number) => Promise<{ event: ZorroEventObject, value: undefined }>,
}
/* eslint-enable max-len*/
