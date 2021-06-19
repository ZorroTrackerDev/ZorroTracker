# ZorroTracker commands reference
## Command assignment table
This table defines how commands are assigned to different things in ZorroTracker. Use this table as a reference when creating drivers or tools to parse command ID's. Below, you will also be able to read about the contents of each block.

| start | end | bytes | owner | description |
| ----:|:---- |:-:| ------- | ------------- |
| 0000 | 0000 | 0 |         | A null ID, representing no command at all. |
| 0001 | 01FF | 1 | shared  | Commands shared between every driver. Each driver should support all of these, if possible. |
| 0200 | 2FFF | 1 | shared  | Commands shared between every driver. Drivers can indicate if they support these commands. This block is intended to standardize command ID's. |
| 3000 | 3FFF | 1 |         | Free to use for any purpose, except for official drivers! |
| 4000 | 46FF | 1 | SMPS    | Commands for various SMPS variants. |
| 4700 | 47FF | 1 | AMPS    | Extension block for SMPS, for AMPS-specific commands. |
| 4800 | 4DFF | 1 | reserved| Reserved for future use. |
| 4E00 | 4EFF | 1 | Westone | Commands for various Westone driver variants. |
| 4E00 | 4EFF | 1 | reserved| Reserved for future use. |
| 5000 | 57FF | 1 | GEMS    | Commands for various GEMS variants. |
| 5800 | 77FF | 1 | reserved| Reserved for future use. |
| 5000 | 57FF | 1 | Zorro   | Commands for Zorrodriver. |
| 5800 | 5FFF | 1 | meta    | Commands for miscellaneous things. |
| 8000 | 80FF | 2 | shared  | Commands shared between every driver. Each driver should support all of these, if possible. |
| 8100 | 8FFF | 2 | shared  | Commands shared between every driver. Drivers can indicate if they support these commands. This block is intended to standardize command ID's. |
| 9000 | 93FF | 2 |         | Free to use for any purpose, except for official drivers! |
| 9400 | 95FF | 2 | SMPS    | Commands for various SMPS variants. |
| 9600 | 96FF | 2 | AMPS    | Extension block for SMPS, for AMPS-specific commands. |
| 9700 | 97FF | 2 | reserved| Reserved for future use. |
| 9800 | 98FF | 2 | Westone | Commands for various Westone driver variants. |
| 9900 | 99FF | 2 | reserved| Reserved for future use. |
| 9A00 | 9BFF | 2 | GEMS    | Commands for various GEMS variants. |
| 9C00 | BDFF | 2 | reserved| Reserved for future use. |
| BE00 | BEFF | 2 | Zorro   | Commands for Zorrodriver. |
| BF00 | BFFF | 2 | meta    | Commands for miscellaneous things. |
| C000 | C07F | 3 | shared  | Commands shared between every driver. Each driver should support all of these, if possible. |
| C080 | C0FF | 3 | meta    | Commands for miscellaneous things. |
| C100 | C1FF | 3 | shared  | Commands shared between every driver. Drivers can indicate if they support these commands. This block is intended to standardize command ID's. |
| C200 | C3FF | 3 |         | Free to use for any purpose, except for official drivers! |
| C400 | C4FF | 3 | SMPS    | Commands for various SMPS variants. |
| C500 | C57F | 3 | AMPS    | Extension block for SMPS, for AMPS-specific commands. |
| C580 | C5FF | 3 | reserved| Reserved for future use. |
| C600 | C67F | 3 | Westone | Commands for various Westone driver variants. |
| C680 | C6FF | 3 | reserved| Reserved for future use. |
| C700 | C7FF | 3 | GEMS    | Commands for various GEMS variants. |
| C800 | CF7F | 3 | reserved| Reserved for future use. |
| CF80 | CFFF | 3 | Zorro   | Commands for Zorrodriver. |
| D000 | D07F | 4 | shared  | Commands shared between every driver. Each driver should support all of these, if possible. |
| D080 | D0FF | 4 | meta    | Commands for miscellaneous things. |
| D100 | D1FF | 4 | shared  | Commands shared between every driver. Drivers can indicate if they support these commands. This block is intended to standardize command ID's. |
| D200 | D3FF | 4 |         | Free to use for any purpose, except for official drivers! |
| D400 | D4FF | 4 | SMPS    | Commands for various SMPS variants. |
| D500 | D57F | 4 | AMPS    | Extension block for SMPS, for AMPS-specific commands. |
| D580 | D5FF | 4 | reserved| Reserved for future use. |
| D600 | D67F | 4 | Westone | Commands for various Westone driver variants. |
| D680 | D6FF | 4 | reserved| Reserved for future use. |
| D700 | D7FF | 4 | GEMS    | Commands for various GEMS variants. |
| D800 | DF7F | 4 | reserved| Reserved for future use. |
| DF80 | DFFF | 4 | Zorro   | Commands for Zorrodriver. |
| E000 | E07F | 5 | shared  | Commands shared between every driver. Each driver should support all of these, if possible. |
| E080 | E0FF | 5 | meta    | Commands for miscellaneous things. |
| E100 | E1FF | 5 | shared  | Commands shared between every driver. Drivers can indicate if they support these commands. This block is intended to standardize command ID's. |
| E200 | E3FF | 5 |         | Free to use for any purpose, except for official drivers! |
| E400 | E4FF | 5 | SMPS    | Commands for various SMPS variants. |
| E500 | E57F | 5 | AMPS    | Extension block for SMPS, for AMPS-specific commands. |
| E580 | E5FF | 5 | reserved| Reserved for future use. |
| E600 | E67F | 5 | Westone | Commands for various Westone driver variants. |
| E680 | E6FF | 5 | reserved| Reserved for future use. |
| E700 | E7FF | 5 | GEMS    | Commands for various GEMS variants. |
| E800 | EF7F | 5 | reserved| Reserved for future use. |
| EF80 | EFFF | 5 | Zorro   | Commands for Zorrodriver. |
| F000 | F07F | 6 | shared  | Commands shared between every driver. Each driver should support all of these, if possible. |
| F080 | F0FF | 6 | meta    | Commands for miscellaneous things. |
| F100 | F1FF | 6 | shared  | Commands shared between every driver. Drivers can indicate if they support these commands. This block is intended to standardize command ID's. |
| F200 | F3FF | 6 |         | Free to use for any purpose, except for official drivers! |
| F400 | F4FF | 6 | SMPS    | Commands for various SMPS variants. |
| F500 | F57F | 6 | AMPS    | Extension block for SMPS, for AMPS-specific commands. |
| F580 | F5FF | 6 | reserved| Reserved for future use. |
| F600 | F67F | 6 | Westone | Commands for various Westone driver variants. |
| F680 | F6FF | 6 | reserved| Reserved for future use. |
| F700 | F7FF | 6 | GEMS    | Commands for various GEMS variants. |
| F800 | FF7F | 6 | reserved| Reserved for future use. |
| FF80 | FFFF | 6 | Zorro   | Commands for Zorrodriver. |

Note that in the future, this list may change in the future. Block sizes reserved for drivers may get smaller for example.

### [Zorro-related blocks]()
### [SMPS-related blocks]()
### [AMPS-related blocks]()
### [GEMS-related blocks]()
### [Westone-related blocks]()

### Block `0001`-`01FF`
1-byte commands shared between every driver. Each driver should support all of these, if possible.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| 0001 | aa | xx | todo |

### Block `0200`-`2FFF`
1-byte commands shared between every driver. Drivers can indicate if they support these commands. This block is intended to standardize command ID's.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| 0200 | aa | xx | todo |

### Block `5800`-`5FFF`
1-byte commands for miscellaneous things.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| 5800 | aa | xx | todo |

### Block `8000`-`80FF`
2-byte commands shared between every driver. Each driver should support all of these, if possible.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| 8000 | aa | xxxx | todo |

### Block `8100`-`8FFF`
2-byte commands shared between every driver. Drivers can indicate if they support these commands. This block is intended to standardize command ID's.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| 8100 | aa | xxxx | todo |

### Block `BF00`-`BFFF`
2-byte commands for miscellaneous things.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| BF00 | aa | xxxx | todo |

### Block `C000`-`C07F`
3-byte commands shared between every driver. Each driver should support all of these, if possible.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| C000 | aa | xxxxxx | todo |

### Block `C080`-`C0FF`
3-byte commands shared between every driver. Drivers can indicate if they support these commands. This block is intended to standardize command ID's.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| C080 | aa | xxxxxx | todo |

### Block `C100`-`C1FF`
3-byte commands for miscellaneous things.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| C100 | aa | xxxxxx | todo |

### Block `D000`-`D07F`
4-byte commands shared between every driver. Each driver should support all of these, if possible.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| D000 | aa | xxxxxxxx | todo |

### Block `D080`-`D0FF`
4-byte commands shared between every driver. Drivers can indicate if they support these commands. This block is intended to standardize command ID's.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| D080 | aa | xxxxxxxx | todo |

### Block `D100`-`D1FF`
4-byte commands for miscellaneous things.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| D100 | aa | xxxxxxxx | todo |

### Block `E000`-`E07F`
5-byte commands shared between every driver. Each driver should support all of these, if possible.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| E000 | aa | xxxxxxxxxx | todo |

### Block `E080`-`E0FF`
5-byte commands shared between every driver. Drivers can indicate if they support these commands. This block is intended to standardize command ID's.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| E080 | aa | xxxxxxxxxx | todo |

### Block `E100`-`E1FF`
5-byte commands for miscellaneous things.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| E100 | aa | xxxxxxxxxx | todo |

### Block `F000`-`F07F`
6-byte commands shared between every driver. Each driver should support all of these, if possible.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| F000 | aa | xxxxxxxxxxxx | todo |

### Block `F080`-`F0FF`
6-byte commands shared between every driver. Drivers can indicate if they support these commands. This block is intended to standardize command ID's.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| F080 | aa | xxxxxxxxxxxx | todo |

### Block `F100`-`F1FF`
6-byte commands for miscellaneous things.
| ID   | code | params | description |
|:----:|:----:|:------:| ----------- |
| F100 | aa | xxxxxxxxxxxx | todo |