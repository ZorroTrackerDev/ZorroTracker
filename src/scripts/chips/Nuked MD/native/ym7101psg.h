//
// Copyright (C) 2018 Alexey Khokholov (Nuke.YKT)
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
//
//  Yamaha YM7101 PSG
//  Thanks:
//      Fritzchens Fritz for YM7101 decap and die shot.
//
// version: 1.0.1
//

#ifndef YM7101PSG_H
#define YM7101PSG_H

#include <stdint.h>

typedef uintptr_t       Bitu;
typedef intptr_t        Bits;
typedef uint64_t        Bit64u;
typedef int64_t         Bit64s;
typedef uint32_t        Bit32u;
typedef int32_t         Bit32s;
typedef uint16_t        Bit16u;
typedef int16_t         Bit16s;
typedef uint8_t         Bit8u;
typedef int8_t          Bit8s;

typedef struct {
    Bit8u latch;
    Bit8u volume[4];
    Bit8u output[4];
    Bit16u freq[4];
    Bit16u counter[4];
    Bit8u sign;
    Bit8u noise_data;
    Bit8u noise_reset;
    Bit8u noise_update;
    Bit8u noise_type;
    Bit16u noise;
    Bit8u inverse;
    Bit8u cycle;
    Bit8u debug;
} psg_t;

void PSG_Reset(psg_t *chip);
void PSG_Write(psg_t *chip, Bit8u data);
Bit16u PSG_Read(psg_t *chip);
void PSG_SetDebugBits(psg_t *chip, Bit16u data);
void PSG_GetSample(psg_t *chip, float *sample);
void PSG_Cycle(psg_t *chip);

#endif