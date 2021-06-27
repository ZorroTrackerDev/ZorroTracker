# ZorroTracker project files
## General information
ZorroTracker project files are simply zip files with specific contents. Different versions of the project files may work differently, and this document will be mentioning historical file formats. ZorroTracker will attempt to convert files from older formats (excluding beta formats, prefixed with a `b`). This document will focus on the file format `b1` mainly, but note differences to older formats along the way.

The project files will contain the following structure inside of them:
* .zorro
* .modules
* modules
	* &lt;module filename&gt;
		* .matrix
		* .patterns

`<module filename>` indicates the unique filename each module has, and a directory for every module will be created.

## Project config file (`.zorro`)
This file is required to exist on every project file. This file contains stuff mainly related to the entire project, that will affect all modules. This is a JSON file, and has following fields:

| field name | field type      | description                                                         |
| ---------- | --------------- | ------------------------------------------------------------------- |
| name       | string          | The name of the project.                                            |
| type       | number          | The type of this project. Must be 0.                                |
| version    | string          | The version of this project. Must a valid.                          |
| driver     | string          | The UUID of the driver emulator to use.                             |
| autosave   | string \| null  | The parent file for an autosave. `null` if this is not an autosave. |

## Module config file (`.modules`)
This file defines the modules in this project file. This is a JSON file, which is an array of objects. Each object has the following fields:

| field name | field type      | description                                                              |
| ---------- | --------------- | ------------------------------------------------------------------------ |
| name       | string          | The display name of the module.                                          |
| author     | string          | The author of the module.                                                |
| lastDate   | date            | The last time when this module was edited.                               |
| index      | number          | The index/order of this module. Usage depends on the driver.             |
| file       | string          | The filename of this module. This is the module-specific directory name. |
| type       | number          | The type of this module:<br/>&nbsp;&nbsp;• `0` = Song files. This is the general music format used in most cases.<br/>&nbsp;&nbsp;• `1` = Sound effect files. Some drivers will support sound effects separately from music.<br/>&nbsp;&nbsp;• `2` = Patch bank files. Some drivers use this to share patches between files. |
| channel    | string?         | The channel data for this module, if the type is either `0` or `1`. The data will be below |

This shows how the channel data is formatted:

| field name | field type      | description                                                              |
| ---------- | --------------- | ------------------------------------------------------------------------ |
| name       | string          | The display name of the channel. This can be anything.                   |
| id         | number          | An unique identifier for the channel. This can be anything.              |
| type       | number          | The channel type for this channel. This helps the UI deal appropriately with the channel.<br/>&nbsp;&nbsp;• `0` = Unspecific. This channel does not have a special purpose.<br/>&nbsp;&nbsp;• `1` = Timer A. This channel controls timer A.<br/>&nbsp;&nbsp;• `16` = YM2612 FM. This is a FM-type channel for the YM2612 chip.<br/>&nbsp;&nbsp;• `17` = YM2612 DAC. This is a PCM-type channel for the YM2612 chip.<br/>&nbsp;&nbsp;• `32` = YM7101 PSG. This is a PSG-type channel for the YM7101 chip.<br/>&nbsp;&nbsp;• `33` = YM7101 DAC. This is a PCM-type channel for the YM7101 chip. |

## Music and sound effect modules
### Matrix data (`.matrix`)
This file defines the data for the pattern matrix. This is a binary file format, using the following algorithm:
1. Find the number of channels from module config (currently, always 11), and check the size of the file. If not divisible by channel count, the file is invalid.
2. The file length divded by channel count is the height of the matrix
3. The data is simply the pattern numbers, where the entire height of the channel is read first.
4. For example, for the data `00 FF 01 00 01 01 00 00 00`, the output could be as follows:

| ch1 | ch2 | ch3 |
|:---:|:---:|:---:|
| 00  | 00  | 00  |
| FF  | 01  | 00  |
| 01  | 01  | 00  |

### Pattern data (`.patterns`)
This file defines the data for each of the patterns for this module. This is a binary file format, using the following algorithm:

* Find the number of channels from module config (currently, always 11). Loop for each channel, and do another loop 256 times, doing the following steps each time:
1. If `00` is read as the first byte, mark the pattern as not existing and skip all other steps.
2. Create a new pattern at this index. The first byte is the number of rows for this pattern, and the second byte is the number of commands for each row. The number of rows can differ from the number of rows for the module itself.
3. Loop over each rows, doing steps 4-6.
4. Read the next byte, which is the note ID for this row.
5. Read the next byte, which is the volume for this row.
6. Repeat the following for the number of commands:
	1. Read the next 2 bytes as the command ID. This is in little endian format.
	2. Read the appropriate number of bytes according to the ID (see the table below). The least significant bytes come first.
* If the file size does not match with the amount of data this algorithm processed, this file is invalid.

This table defines the amount of bytes for each command ID range:

| start | end | bytes |
| ----:|:---- |:-:|
| 0000 | 0000 | 0 |
| 0001 | 7FFF | 1 |
| 8000 | BFFF | 2 |
| C000 | CFFF | 3 |
| D000 | DFFF | 4 |
| E000 | EFFF | 5 |
| F000 | FFFF | 6 |

## Patch bank modules
N/A
