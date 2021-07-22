import { Module, Project } from "../ui/misc/project";
import { PlayMode, Tab } from "../ui/misc/tab";
import { Channel } from "./driver";
import { Matrix } from "./matrix";
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

	LoadTheme,						// event that is ran when a new theme is loaded

	SwitchTab,						// event that is ran when a new tab is activated
	TabMute,						// event that is ran when a mute state of the channel was updated
	TabPlayMode,					// event that is ran when the playback mode was changed
	TabRecordMode,					// event that is ran when the record mode was changed

	ProjectOpen,					// event that is ran when a project is opened or created
	ProjectPatternRows,				// event that is ran when the number of pattern rows are changed
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

type ZorroListenerReturn<T> = Promise<undefined|void|T>

/* eslint-disable max-len*/
export interface ZorroListenerTypes {
	[ZorroEventEnum.Exit]: (event:ZorroEventObject) => ZorroListenerReturn<void>,
	[ZorroEventEnum.ClipboardGet]: (event:ZorroEventObject, type:ClipboardType) => ZorroListenerReturn<string>,
	[ZorroEventEnum.ClipboardSet]: (event:ZorroEventObject, type:ClipboardType, data:string) => ZorroListenerReturn<string>,

	[ZorroEventEnum.LoadTheme]: (event:ZorroEventObject) => ZorroListenerReturn<void>,

	[ZorroEventEnum.TabMute]: (event:ZorroEventObject, tab:Tab, channel:Channel, state:boolean) => ZorroListenerReturn<void>,
	[ZorroEventEnum.TabPlayMode]: (event:ZorroEventObject, tab:Tab, mode:PlayMode) => ZorroListenerReturn<void>,
	[ZorroEventEnum.TabRecordMode]: (event:ZorroEventObject, tab:Tab, mode:boolean) => ZorroListenerReturn<void>,

	[ZorroEventEnum.ProjectOpen]: (event:ZorroEventObject, project:Project|undefined) => ZorroListenerReturn<void>,
	[ZorroEventEnum.ProjectPatternRows]: (event:ZorroEventObject, project:Project, module:Module, rows:number) => ZorroListenerReturn<void>,
	[ZorroEventEnum.SelectModule]: (event:ZorroEventObject, project:Project, module:Module|undefined) => ZorroListenerReturn<void>,
	[ZorroEventEnum.ModuleUpdate]: (event:ZorroEventObject, project:Project, module:Module) => ZorroListenerReturn<void>,
	[ZorroEventEnum.ModuleCreate]: (event:ZorroEventObject, project:Project, module:Module) => ZorroListenerReturn<void>,
	[ZorroEventEnum.ModuleDelete]: (event:ZorroEventObject, project:Project, module:Module) => ZorroListenerReturn<void>,

	[ZorroEventEnum.MatrixSet]: (event:ZorroEventObject, index:Matrix, channel:number, row:number, value:number) => ZorroListenerReturn<number>,
	[ZorroEventEnum.MatrixGet]: (event:ZorroEventObject, index:Matrix, channel:number, row:number, value:number) => ZorroListenerReturn<number>,
	[ZorroEventEnum.MatrixResize]: (event:ZorroEventObject, index:Matrix, height:number, width:number) => ZorroListenerReturn<void>,
	[ZorroEventEnum.MatrixInsert]: (event:ZorroEventObject, index:Matrix, row:number, data:Uint8Array) => ZorroListenerReturn<void>,
	[ZorroEventEnum.MatrixRemove]: (event:ZorroEventObject, index:Matrix, row:number) => ZorroListenerReturn<void>,

	[ZorroEventEnum.PatternTrim]: (event:ZorroEventObject, index:Matrix, channel:number, position:number) => ZorroListenerReturn<void>,
	[ZorroEventEnum.PatternMake]: (event:ZorroEventObject, index:Matrix, channel:number, position:number) => ZorroListenerReturn<void>,

	[ZorroEventEnum.MidiNoteOn]: (event:ZorroEventObject, channel:number, note:number, velocity:number) => ZorroListenerReturn<void>,
	[ZorroEventEnum.MidiNoteOff]: (event:ZorroEventObject, channel:number, note:number, velocity:number) => ZorroListenerReturn<void>,
}

/**
 * Different sender function types. Each emitter expects to use the following functions
 */

type ZorroSenderReturn<T> = Promise<{ event: ZorroEventObject, value: T|undefined }>

export interface ZorroSenderTypes {
	[ZorroEventEnum.Exit]: () => ZorroSenderReturn<undefined>,
	[ZorroEventEnum.ClipboardGet]: (type:ClipboardType) => ZorroSenderReturn<string>,
	[ZorroEventEnum.ClipboardSet]: (type:ClipboardType, data:string) => ZorroSenderReturn<string>,

	[ZorroEventEnum.LoadTheme]: () => ZorroSenderReturn<undefined>,

	[ZorroEventEnum.TabMute]: (tab:Tab, channel:Channel, state:boolean) => ZorroSenderReturn<undefined>,
	[ZorroEventEnum.TabPlayMode]: (tab:Tab, mode:PlayMode) => ZorroSenderReturn<undefined>,
	[ZorroEventEnum.TabRecordMode]: (tab:Tab, mode:boolean) => ZorroSenderReturn<undefined>,

	[ZorroEventEnum.ProjectOpen]: (project:Project|undefined) => ZorroSenderReturn<undefined>,
	[ZorroEventEnum.ProjectPatternRows]: (project:Project, module:Module, rows:number) => ZorroSenderReturn<undefined>,
	[ZorroEventEnum.SelectModule]: (project:Project, module:Module|undefined) => ZorroSenderReturn<undefined>,
	[ZorroEventEnum.ModuleUpdate]: (project:Project, module:Module) => ZorroSenderReturn<undefined>,
	[ZorroEventEnum.ModuleCreate]: (project:Project, module:Module) => ZorroSenderReturn<undefined>,
	[ZorroEventEnum.ModuleDelete]: (project:Project, module:Module) => ZorroSenderReturn<undefined>,

	[ZorroEventEnum.MatrixSet]: (index:Matrix, channel:number, row:number, value:number) => ZorroSenderReturn<number>,
	[ZorroEventEnum.MatrixGet]: (index:Matrix, channel:number, row:number, value:number) => ZorroSenderReturn<number>,
	[ZorroEventEnum.MatrixResize]: (index:Matrix, height:number, width:number) => ZorroSenderReturn<undefined>,
	[ZorroEventEnum.MatrixInsert]: (index:Matrix, row:number, data:Uint8Array) => ZorroSenderReturn<undefined>,
	[ZorroEventEnum.MatrixRemove]: (index:Matrix, row:number) => ZorroSenderReturn<undefined>,

	[ZorroEventEnum.PatternTrim]: (index:Matrix, channel:number, position:number) => ZorroSenderReturn<undefined>,
	[ZorroEventEnum.PatternMake]: (index:Matrix, channel:number, position:number) => ZorroSenderReturn<undefined>,

	[ZorroEventEnum.MidiNoteOn]: (channel:number, note:number, velocity:number) => ZorroSenderReturn<undefined>,
	[ZorroEventEnum.MidiNoteOff]: (channel:number, note:number, velocity:number) => ZorroSenderReturn<undefined>,
}
/* eslint-enable max-len*/
