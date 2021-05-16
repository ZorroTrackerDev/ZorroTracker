
Number.prototype.toHex = function(digits:number) {
	return this.toString(16).toUpperCase().padStart(digits, "0");
};

Number.prototype.toByte = function() {
	return this.toHex(2);
};