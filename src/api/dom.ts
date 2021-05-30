let _uniqueID = 0;

/**
 * Function to give an element an unique identifier, to facilitate proper labelling
 *
 * @returns An unique DOM element ID
 */
export function getUniqueID(): string {
	return "u-"+ (_uniqueID++);
}