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

#include <stdio.h>
#include "ym7101psg.h"

const float psg_vol[17] = {
    1.0, 0.772, 0.622, 0.485, 0.382, 0.29, 0.229, 0.174, 0.132, 0.096, 0.072, 0.051, 0.034, 0.019, 0.009, 0.0, -1.059
};

const Bit8u psg_debug_chan[4] = {
    0, 2, 1, 3
};


void PSG_Reset(psg_t *chip)
{
    // TODO: verify
    chip->latch = 7;
    chip->volume[0] = 0x0f;
    chip->volume[1] = 0x0f;
    chip->volume[2] = 0x0f;
    chip->volume[3] = 0x0f;
    chip->output[0] = 0x0f;
    chip->output[1] = 0x0f;
    chip->output[2] = 0x0f;
    chip->output[3] = 0x0f;
    chip->freq[0] = 0;
    chip->freq[1] = 0;
    chip->freq[2] = 0;
    chip->freq[3] = 0x10;
    chip->counter[0] = 0;
    chip->counter[1] = 0;
    chip->counter[2] = 0;
    chip->counter[3] = 0;
    chip->noise_data = 0;
    chip->noise = 0;
    chip->noise_reset = 0;
    chip->noise_update = 0;
    chip->noise_type = 0;
    chip->sign = 0;
    chip->inverse = 0x0f;
    chip->cycle = 0;
    chip->debug = 0;
}

void PSG_Write(psg_t *chip, Bit8u data)
{
    if (data & 0x80)
    {
        chip->latch = (data >> 4) & 0x07;
    }
    // Update volume
    if (chip->latch & 0x01)
    {
        chip->volume[chip->latch>>1] = data & 0x0f;
    }
    else
    {
        Bit8u channel = chip->latch>>1;
        if (channel != 3)
        {
            // Square wave
            if (data & 0x80)
            {
                chip->freq[channel] &= 0x3f0;
                chip->freq[channel] |= data & 0x0f;
            }
            else
            {
                chip->freq[channel] &= 0x0f;
                chip->freq[channel] |= (data << 4) & 0x3f0;
            }
        }
        else
        {
            // Noise
            Bit8u freq = data&0x03;
            chip->noise_reset |= 0x01;
            chip->noise_type = 0;
            chip->noise_data = data&0x07;
            if (freq != 3)
                chip->freq[3] = 0x10 << freq;
            else
            {
                chip->freq[3] = 0;
                chip->noise_type |= 0x01;
            }
            chip->noise_type |= (data >> 1) & 0x02;
        }
    }
}

void PSG_UpdateSample(psg_t *chip)
{
    Bit32u i;
    if (chip->debug & 0x01)
    {
        chip->output[0] = chip->volume[0];
        chip->output[1] = chip->volume[1];
        chip->output[2] = chip->volume[2];
        chip->output[3] = chip->volume[3];
        return;
    }
    // Update digital output
    for (i = 0; i < 3; i++)
        if ((chip->sign >> i) & 0x01)
            chip->output[i] = chip->volume[i];
        else
            chip->output[i] = 0x0f;
    if (chip->noise & (0x01 << 14))
        chip->output[3] = chip->volume[3];
    else
        chip->output[3] = 0x0f;
}

Bit16u PSG_Read(psg_t *chip)
{
    Bit16u sample = 0;
    Bit32u i;
    PSG_UpdateSample(chip);
    for (i = 0; i < 4; i++)
        sample |= chip->output[i] << (4*(3 - i));
    return sample;
}

void PSG_SetDebugBits(psg_t *chip, Bit16u data)
{
    chip->debug = (data >> 9) & 0x07;
}

void PSG_GetSample(psg_t *chip, float *sample)
{
    Bit32u i;
    float tsample;
    PSG_UpdateSample(chip);
    if (chip->debug & 0x01)
    {
        tsample = 3 * psg_vol[16];
        tsample += psg_vol[chip->output[psg_debug_chan[chip->debug>>1]]];
        *sample = tsample;
        return;
    }
    tsample = 0.0;
    for (i = 0; i < 4; i++)
    {
        tsample += psg_vol[chip->output[i]];
    }
    *sample = tsample;
}

void PSG_Cycle(psg_t *chip)
{
    Bit16u counter;

    // Update noise
    chip->noise_update <<= 1;
    chip->noise_update |= (chip->sign >> (3 - ((chip->noise_type & 0x01)))) & 0x01;
    if ((chip->noise_update & 0x03) == 0x01)
    {
        Bit8u noise_bit = 0;
        if ((chip->noise & 0x7fff) == 0)
            noise_bit = 1;
        if (chip->noise_type & 0x02)
            noise_bit |= ((chip->noise >> 15) ^ (chip->noise >> 12)) & 0x01;
        chip->noise = (chip->noise << 1) | noise_bit;
    }
    if (chip->noise_reset & 0x02)
        chip->noise_data = 0;
    
    // Update sign
    if (chip->cycle == 0)
    {
        chip->sign ^= chip->inverse;
        chip->inverse = 0;
    }

    // Update counter
    counter = chip->counter[chip->cycle];
    if (counter >= chip->freq[chip->cycle])
    {
        counter = 0;
        chip->inverse |= 1<<chip->cycle;
    }
    chip->counter[chip->cycle] = counter + 1;

    chip->cycle = (chip->cycle + 1) & 0x03;
    chip->noise_reset <<= 1;
}
