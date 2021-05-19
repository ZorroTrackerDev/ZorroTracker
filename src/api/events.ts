import { PatternIndex } from "./pattern";

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
	public static createEvent(name:ZorroEventEnum): { send: ZorroListenerTypes[ZorroEventEnum] }{
		// if event didn't exist before, create it
		if(!ZorroEvent.events[name]){
			ZorroEvent.events[name] = new ZorroEvent(name);
		}

		return {
			/**
			 * Function to call the event handlers and return a boolean on whether the event was cancelled
			 *
			 * @param args The arguments for the event call
			 */
			send: (...args:any[]) => {
				return ZorroEvent.events[name].send(args);
			},
		}
	}

	/**
	 * Add an event listener to an event
	 *
	 * @param name name of the event
	 * @param func The function to execute for the event
	 */
	public static addListener(name:ZorroEventEnum, func:ZorroListenerTypes[ZorroEventEnum]):void {
		// if event didn't exist before, create it
		if(!ZorroEvent.events[name]){
			ZorroEvent.events[name] = new ZorroEvent(name);
		}

		// if the listener was not found, add it to the list
		if(!ZorroEvent.events[name].listeners.includes(func)){
			ZorroEvent.events[name].listeners.push(func);
		}
	}

	/**
	 * Remove an event listener from an event
	 *
	 * @param name name of the event
	 * @param func The function to remove from the event
	 */
	public static removeListener(name:ZorroEventEnum, func:ZorroListener):void {
		// if event didn't exist before, create it
		if(!ZorroEvent.events[name]){
			ZorroEvent.events[name] = new ZorroEvent(name);
		}

		// if the listener was not found, add it to the list
		const index = ZorroEvent.events[name].listeners.indexOf(func);

		if(index >= 0){
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
	private async send(args:any[]) {
		// run through all the listeners
		for(const fn of this.listeners){
			// run the next function.
			if(!await fn(...args)) {
				// event was cancelled by function, return immediately
				return false;
			}
		}

		// was not cancelled
		return true;
	}

	// list of all the event listeners
	private listeners:ZorroListener[];
}

/**
 * The function type for ZorroTracker listeners
 */
export type ZorroListener = (...args:any[]) => Promise<boolean|undefined>;

/**
 * Enum that holds all the names for the events
 */
export enum ZorroEventEnum {
	PatternMatrixSet,
	PatternMatrixGet,
}

export interface ZorroListenerTypes {
	[ZorroEventEnum.PatternMatrixSet]: (index:PatternIndex, channel:number, row:number, value:number) => Promise<boolean|undefined>,
	[ZorroEventEnum.PatternMatrixGet]: (index:PatternIndex, channel:number, row:number, value:number) => Promise<boolean|undefined>,
}