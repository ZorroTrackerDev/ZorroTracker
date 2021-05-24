import { loadFlag } from "./files";

export type UndoAction = {
	/**
	 * Source of the undo/redo action element
	 */
	source: UndoSource,

	/**
	 * Function to undo the action
	 */
	undo: () => Promise<void|unknown>,

	/**
	 * Function to redo the action (will also be called with the `add` method call)
	 */
	redo: () => Promise<void|unknown>,
};

/**
 * Various undo source types. This can help with displaying undo actions
 */
export enum UndoSource {
	Matrix,
}

/**
 * The class for handling undo's and redo's.
 */
export class Undo {
	private static stack:UndoAction[] = [];
	private static index = 0;
	private static redoSize:number|undefined;

	/**
	 * Add a new undo/redo action to history
	 *
	 * @param data The UndoAction data type to push
	 */
	public static add(data:UndoAction): Promise<unknown> {
		// clip any stack elements that are no longer used
		Undo.clip();

		// add element to the end and fix index.
		Undo.stack.push(data);
		Undo.index = Undo.stack.length;

		// run the redo action
		return data.redo();
	}

	/**
	 * Function to remove extra elements from the undo stack
	 */
	public static clip():void {
		if(this.redoSize === undefined) {
			// load the redo size from files
			this.redoSize = loadFlag("UNDO_STACK_SIZE") as number;
		}

		// check if any elements need to be clipped off the end of the stack
		if(Undo.index !== Undo.stack.length) {
			Undo.stack.splice(Undo.index);
			Undo.index = Undo.stack.length;
		}

		if(Undo.index >= this.redoSize) {
			// index is out of range, remove extra elements from the beginning
			while(Undo.stack.length >= this.redoSize) {
				Undo.stack.shift();
			}

			// fix index number
			Undo.index = Undo.stack.length;
		}
	}

	/**
	 * Execute the previous undo action
	 *
	 * @returns Boolean on whether there was an undo action to execute
	 */
	public static async undo(): Promise<boolean> {
		if(Undo.index > 0){
			await Undo.stack[--Undo.index].undo();
			return true;
		}

		return false;
	}

	/**
	 * Execute the next redo action
	 *
	 * @returns Boolean on whether there was a redo action to execute
	 */
	public static async redo(): Promise<boolean> {
		if(Undo.index < Undo.stack.length){
			await Undo.stack[Undo.index++].redo();
			return true;
		}

		return false;
	}
}

