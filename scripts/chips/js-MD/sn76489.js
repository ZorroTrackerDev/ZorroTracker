/* eslint-disable */
// I am not gonna go and lint the entire file. This is not my code, shh! :-)
function SN76489() {
	if (!this instanceof SN76489) return new SN76489();
	this.attenuation = 16384;
/*
	void SN76489_Init(int which, int PSGClockValue, int SamplingRate);
	void SN76489_Reset(int which);
	void SN76489_Shutdown(void);
	void SN76489_Config(int which, int mute, int boost, int volume, int feedback);
	void SN76489_SetContext(int which, uint8 *data);
	void SN76489_GetContext(int which, uint8 *data);
	uint8 *SN76489_GetContextPtr(int which);
	int SN76489_GetContextSize(void);
	void SN76489_Write(int which, int data);
	void SN76489_GGStereoWrite(int which, int data);
	void SN76489_Update(int which, INT16 **buffer, int length);
*/
}

(function(S){
var SN = {};
SN.feedback_patterns = {
	FB_BBCMICRO:0x8005,
	FB_SC3000:0x0003,
	FB_SEGAVDP:0x0009
};
SN.volume_modes = {
	VOL_TRUNC:0,
	VOL_FULL:1,
	VOL_MAME:2
};
SN.boost_modes = {
	BOOST_OFF:0,
	BOOST_ON:1
};
SN.mute_values = {
	MUTE_ALLOFF:0,
	MUTE_TONE1:1,
	MUTE_TONE2:2,
	MUTE_TONE3:4,
	MUTE_NOISE:8,
	MUTE_ALLON:15
};

var sn76489 = (function() {
	var o = {};
	o.Mute = 0;	// int
	o.BoostNoise = 0;	// int
	o.VolumeArray = 0;	// int
	o.Clock = 0.0;	// float
	o.dClock = 0.0;	// float
	o.PSGStereo = 0;	// int
	o.NumClocksForSample = 0;	// int
	o.WhiteNoiseFeedback = 0;	// int
	o.Registers = [0,0,0,0,0,0,0,0];	// UINT16[8], Tone+vol*4
	o.LatchedRegister = 0;	// int
	o.NoiseShiftRegister = SN.NoiseInitialState;	// UINT16
	o.NoiseShiftWidth = 16;
	o.NoiseFreq = 0;	// INT16, noise channel signal generator frequency
	o.ToneFreqVals = [0,0,0,0];	// INT16[4], frequency register values (counters)
	o.ToneFreqPos = [0,0,0,0];	// INT8[4], frequency channel flip-flops
	o.Channels = [0,0,0,0];	// INT16[4], value of each channel before stereo is applied
	o.IntermediatePos = [0,0,0,0];	// INT32[4], intermediate values used at boundaries between + and -
	o.muted = [0,0,0,0];	// +neo
	return o;
})();

S.prototype.ENUM = {
	feedback_patterns:SN.feedback_patterns,
	volume_modes:SN.volume_modes,
	boost_modes:SN.boost_modes,
	mute_values:SN.mute_values
};

SN.NoiseInitialState = 0x8000;
SN.PSG_CUTOFF = 0x6;
SN.PSGVolumeValues = [
	[892,892,892,760,623,497,404,323,257,198,159,123,96,75,60,0],
	[1516,1205,957,760,603,479,381,303,240,191,152,120,96,76,60,0],
	[4096,3254,2584,2053,1631,1295,1029,817,649,516,410,325,258,205,163,0]
];

S.prototype.reset = function() {
	console.log("SN::reset");
	(function(p){
		p.PSGStereo = 0xff;
		var i = 4; while (--i>-1) {
			// initialize psg state
			p.Registers[i<<1] = 1;	// tone freq=1
			p.Registers[(i<<1)+1] = 0xf;	// vol=off
			//console.log("reg "+(1+(i<<1))+"="+p.Registers[(i<<1)+1]);
			p.ToneFreqVals[i] = 0;	// set counters to 0
			p.ToneFreqPos[i] = 1;	// set flip-flops to 1
			p.IntermediatePos[i] = null;	// set intermediate positions to do-not-use value
		}
		p.LatchedRegister = 0;
		p.NoiseShiftRegister = SN.NoiseInitialState;	// init noise generator
		p.NoiseFreq = 0x10;
		p.muted = [0,0,0,0];	// +neo
		p.Clock = 0;	// zero the clock
	})(sn76489);
};
S.prototype.init = function(pcl, srate) {	// int clock value, int sampling rate
	sn76489.dClock = pcl*1.0/(srate<<4);
	console.log("SN::init("+pcl+','+srate+','+sn76489.dClock+")");
	this.reset();
};
S.prototype.shutdown = function(){};
S.prototype.config = function(mute, boost, volume, feedback, nsw) {	// int, int, int, int, int
	console.log("SN::config("+mute.toString(2)+','+(boost?1:0)+','+volume+','+feedback+','+nsw+")");
	(function(p){
		p.Mute = mute;
		p.BoostNoise = boost;
		p.VolumeArray = volume;
		p.WhiteNoiseFeedback = feedback;
		p.NoiseShiftWidth = nsw;
	})(sn76489);
};
S.prototype.setContext = function(){};
S.prototype.getContext = function(){};
S.prototype.getContextPtr = function(){return sn76489;};
S.prototype.getContextSize = function(){return 1;};
S.prototype.write = function(data) {	// int
	(function(p){
		if (data&0x80) {	// latch/data byte	%1 cc t dddd
			//console.log("PSG::write L "+data.toString(2)+" - "+((data>>5)&0x3)+" "+(data&0x10?'V':'T')+" "+(data&0xf).toString(2));
			p.LatchedRegister = (data>>4)&0x07;
			p.Registers[p.LatchedRegister] = (p.Registers[p.LatchedRegister]&0x3f0)|(data&0xf);	// zero low 4 bits and replace w/data
		}
		else {	// data byte	%0 - dddddd
			//console.log("PSG::write D "+data.toString(2));
			if (p.LatchedRegister&1)	// attenuation register
				p.Registers[p.LatchedRegister] = data&0x0f;	// replace w/data
			else if (p.LatchedRegister<5)	// tone register
				p.Registers[p.LatchedRegister] = (p.Registers[p.LatchedRegister]&0x00f)|((data&0x3f)<<4);	// zero high 6 bits and replace w/data
			else p.Registers[p.LatchedRegister] = data&0x0f;
		}
		switch (p.LatchedRegister) {
			case 0: case 2: case 4:	// tone channels
				if (p.Registers[p.LatchedRegister]===0) p.Registers[p.LatchedRegister] = 1;	// zero frequency changed to 1 to avoid div/0
				break;
			case 6:	// noise
				p.NoiseShiftRegister = SN.NoiseInitialState;	// reset shift register
				p.NoiseFreq = 0x10<<(p.Registers[6]&0x3);	// set noise signal generator frequency
				break;
		}
	})(sn76489);
};
S.prototype.GGStereoWrite = function(data){sn76489.PSGStereo=data;};
S.prototype.update = function(len) {
	if (!sn76489.dClock) return;
	var buf = Buffer.alloc(len*4);
	var address = 0;
	(function(p){
		var i, j, nsr = [], fv = [], q = [], _r, stereo = [ 0, 0 ];
		j = -1; while (++j<len) {
			q[0] = p.ToneFreqVals[0].toFixed(2);
			q[1] = p.Registers[0];
			q[2] = p.NumClocksForSample/p.Registers[0];
			i = -1; while (++i<3) {
				_r = i<<1;
				p.Channels[i] = ((p.Mute>>i)&0x1)*SN.PSGVolumeValues[p.VolumeArray][p.Registers[_r+1]]*(
					p.IntermediatePos[i]!==null?
						p.IntermediatePos[i]/65536.0 :
						p.ToneFreqPos[i]
				);
				//console.log("ch "+i+" "+(p.Mute>>i&0x1?'+':'-')+" "+p.Channels[i]+" (reg "+(1+(i<<1))+"="+p.Registers[(i<<1)+1]+" v "+SN.PSGVolumeValues[p.VolumeArray][p.Registers[(i<<1)+1]]+" ipos "+p.IntermediatePos[i]+" fpos "+p.ToneFreqPos[i]+")");
			}
			fv[fv.length] = '['+q.toString(',')+']';
			//console.log("ch "+i+" "+(p.Mute>>i&0x1?'+':'-')+" "+p.Channels[i]+" (reg "+(1+(i<<1))+"="+p.Registers[(i<<1)+1]+" v "+SN.PSGVolumeValues[p.VolumeArray][p.Registers[(i<<1)+1]]+" nsr "+p.NoiseShiftRegister+")");
			p.Channels[3] = ((p.Mute>>3)&0x1)*SN.PSGVolumeValues[p.VolumeArray][p.Registers[7]]*((p.NoiseShiftRegister&0x01)<<1-1);
			//nsr.push(p.Channels[3]/16384);
			//console.log(p.NoiseShiftRegister&0x1);
			if (p.BoostNoise) p.Channels[3] = p.Channels[3]*2;	// double noise volume if preferred
			//// advance counters
			p.Clock += p.dClock;
			p.NumClocksForSample = (p.Clock)|0;
			p.Clock -= p.NumClocksForSample;
			//// buffer
			stereo[0] = stereo[1] = 0;
			i = 3;
			if (!p.muted[i])
				stereo[0] += ((p.PSGStereo>>(i+4))&0x1)*p.Channels[i],
				stereo[1] += ((p.PSGStereo>>i)&0x1)*p.Channels[i];
			//buf[0][j] = 0;
			//buf[1][j] = 0;
			var _f3 = null;
			i = -1; while (++i<3) {
				//console.log("buf["+j+"]["+i+"]="+p.Channels[i]);
				_r = i<<1;
				if (!p.muted[i])
					stereo[0] += ((p.PSGStereo>>(i+4))&0x1)*p.Channels[i],
					stereo[1] += ((p.PSGStereo>>i)&0x1)*p.Channels[i];
				//// rolled into buffer loop for fewer loops
				//if (i<3) {
					p.ToneFreqVals[i] -= p.NumClocksForSample;
					if (i===2) _f3 = p.ToneFreqVals[i];
					if (p.ToneFreqVals[i]<=0) {
						if (p.Registers[i<<1]>SN.PSG_CUTOFF) {
							p.IntermediatePos[i] = ((p.NumClocksForSample-p.Clock+(p.ToneFreqVals[i]*2.0))*p.ToneFreqPos[i]/(p.NumClocksForSample+p.Clock)*65536.0);//|0;
							p.ToneFreqPos[i] = 0-p.ToneFreqPos[i];	// flip the flip-flop
						}
						else {
							p.ToneFreqPos[i] = 1;	// stuck value
							p.IntermediatePos[i] = null;
						}
						p.ToneFreqVals[i] += p.Registers[_r]*1.0*((p.NumClocksForSample/p.Registers[_r]+1)|0);
					}
					else p.IntermediatePos[i] = null;
					//p.ToneFreqVals[i] |= 0;
				//}
			}
			if (isNaN(stereo[0])) throw new Error("buffer "+j+" NaN! check output!");

			// write stereo to buf (signed 16-bit little endian)
			buf.writeInt16LE(stereo[0], address);
			buf.writeInt16LE(stereo[1], address + 2);
			address += 4;

			// decrement tone channel counters
			//i = -1; while (++i<3) p.ToneFreqVals[i] -= p.NumClocksForSample;	// moved to buffer loop for speed
			// noise channel: match to tone2 or decrement its counter
			if (p.NoiseFreq===0x80&&_f3!==null) p.ToneFreqVals[3] = _f3;
			else p.ToneFreqVals[3] -= p.NumClocksForSample;
			/*i = -1; while (++i<3) {	// tone channels
				if (p.ToneFreqVals[i]<=0) {
					if (p.Registers[i<<1]>=SN.PSG_CUTOFF) {
						p.IntermediatePos[i] = ((p.NumClocksForSample-p.Clock+(p.ToneFreqVals[i]<<1))*p.ToneFreqPos[i]/(p.NumClocksForSample+p.Clock)*65536)|0;
						p.ToneFreqPos[i] = 0-p.ToneFreqPos[i];	// flip the flip-flop
					}
					else {
						p.ToneFreqPos[i] = 1;	// stuck value
						p.IntermediatePos[i] = null;
					}
					p.ToneFreqVals[i] += p.Registers[i<<1]*(p.NumClocksForSample/p.Registers[i<<1]+1);
				}
				else p.IntermediatePos[i] = null;
			}*/	// moved to buffer loop for speed
			if (p.ToneFreqVals[3]<=0) {	// noise channel
				p.ToneFreqPos[3] = 0-p.ToneFreqPos[3];	// flip the flip-flop
				if (p.NoiseFreq!==0x80)	// if not matching tone2, decrement counter
					p.ToneFreqVals[3] += p.NoiseFreq*(p.NumClocksForSample/p.NoiseFreq+1);
				if (p.ToneFreqPos[3]===1) {	// only once per cycle
					var Feedback = p.NoiseShiftRegister;	// int
					if (p.Registers[6]&0x4) {	// white noise
						switch (p.WhiteNoiseFeedback) {	// calculate parity of fed-back bits for feedback
							case 0x0003:
							case 0x0006:	// SC-3000, %00000110
							case 0x0009:	// SMS, GG, MD, %00001001
								Feedback = ((Feedback&p.WhiteNoiseFeedback)&&((Feedback&p.WhiteNoiseFeedback)^p.WhiteNoiseFeedback))?1:0;
								break;
							case 0x8005:	// BBC Micro, falls thru
							default:
								Feedback = Feedback&p.WhiteNoiseFeedback;
								Feedback ^= Feedback>>8;
								Feedback ^= Feedback>>4;
								Feedback ^= Feedback>>2;
								Feedback ^= Feedback>>1;
								Feedback &= 1;
								break;
						}
						//console.log('reg[6]='+p.Registers[6]+' (white), '+Feedback);
					}
					else {	// periodic noise
						Feedback = Feedback&1;
						//console.log('reg[6]='+p.Registers[6]+' (per), '+Feedback);
					}
					p.NoiseShiftRegister = (p.NoiseShiftRegister>>1)|(Feedback<<(p.NoiseShiftWidth-1));
				}
			}
			//p.ToneFreqVals[3] |= 0;
		}
		//console.log("***:"+fv.toString(', '));
		//console.log("***:"+nsr.toString(','));
	})(sn76489);
	return buf;
};
/** interleaved stereo mix +neo **/
S.prototype.mixStereo = function(buf,len,z) {
	if (!sn76489.dClock) return buf;
	var _sc = 1.0/this.attenuation;
	(function(p){
		var i, j, nsr = [], fv = [], q = [], _r, vl = 0, vr = 0;
		var n = z|0;
		j = -1; while (++j<len) {
			q[0] = p.ToneFreqVals[0].toFixed(2);
			q[1] = p.Registers[0];
			q[2] = p.NumClocksForSample/p.Registers[0];
			i = -1; while (++i<3) {
				_r = i<<1;
				p.Channels[i] = ((p.Mute>>i)&0x1)*SN.PSGVolumeValues[p.VolumeArray][p.Registers[_r+1]]*(
					p.IntermediatePos[i]!==null?
						p.IntermediatePos[i]/65536.0 :
						p.ToneFreqPos[i]
				);
				//console.log("ch "+i+" "+(p.Mute>>i&0x1?'+':'-')+" "+p.Channels[i]+" (reg "+(1+(i<<1))+"="+p.Registers[(i<<1)+1]+" v "+SN.PSGVolumeValues[p.VolumeArray][p.Registers[(i<<1)+1]]+" ipos "+p.IntermediatePos[i]+" fpos "+p.ToneFreqPos[i]+")");
			}
			fv[fv.length] = '['+q.toString(',')+']';
			//console.log("ch "+i+" "+(p.Mute>>i&0x1?'+':'-')+" "+p.Channels[i]+" (reg "+(1+(i<<1))+"="+p.Registers[(i<<1)+1]+" v "+SN.PSGVolumeValues[p.VolumeArray][p.Registers[(i<<1)+1]]+" nsr "+p.NoiseShiftRegister+")");
			p.Channels[3] = ((p.Mute>>3)&0x1)*SN.PSGVolumeValues[p.VolumeArray][p.Registers[7]]*((p.NoiseShiftRegister&0x01)<<1-1);
			//nsr.push(p.Channels[3]/16384);
			//console.log(p.NoiseShiftRegister&0x1);
			if (p.BoostNoise) p.Channels[3] = p.Channels[3]*2;	// double noise volume if preferred
			//// advance counters
			p.Clock += p.dClock;
			p.NumClocksForSample = (p.Clock)|0;
			p.Clock -= p.NumClocksForSample;
			//// buffer
			//buf[0][j] = buf[1][j] = 0;
			vl = 0, vr = 0;
			i = 3; if (!p.muted[i])
				vl += ((p.PSGStereo>>(i+4))&0x1)*p.Channels[i],
				vr += ((p.PSGStereo>>i)&0x1)*p.Channels[i];
			var _f3 = null;
			i = -1; while (++i<3) {
				//console.log("buf["+j+"]["+i+"]="+p.Channels[i]);
				_r = i<<1;
				if (!p.muted[i])
					vl += ((p.PSGStereo>>(i+4))&0x1)*p.Channels[i],
					vr += ((p.PSGStereo>>i)&0x1)*p.Channels[i];
				//// rolled into buffer loop for fewer loops
				//if (i<3) {
					p.ToneFreqVals[i] -= p.NumClocksForSample;
					if (i===2) _f3 = p.ToneFreqVals[i];
					if (p.ToneFreqVals[i]<=0) {
						if (p.Registers[i<<1]>SN.PSG_CUTOFF) {
							p.IntermediatePos[i] = ((p.NumClocksForSample-p.Clock+(p.ToneFreqVals[i]*2.0))*p.ToneFreqPos[i]/(p.NumClocksForSample+p.Clock)*65536.0);//|0;
							p.ToneFreqPos[i] = 0-p.ToneFreqPos[i];	// flip the flip-flop
						}
						else {
							p.ToneFreqPos[i] = 1;	// stuck value
							p.IntermediatePos[i] = null;
						}
						p.ToneFreqVals[i] += p.Registers[_r]*1.0*((p.NumClocksForSample/p.Registers[_r]+1)|0);
					}
					else p.IntermediatePos[i] = null;
					//p.ToneFreqVals[i] |= 0;
				//}
			}
			// decrement tone channel counters
			//i = -1; while (++i<3) p.ToneFreqVals[i] -= p.NumClocksForSample;	// moved to buffer loop for speed
			// noise channel: match to tone2 or decrement its counter
			if (p.NoiseFreq===0x80&&_f3!==null) p.ToneFreqVals[3] = _f3;
			else p.ToneFreqVals[3] -= p.NumClocksForSample;
			/*i = -1; while (++i<3) {	// tone channels
				if (p.ToneFreqVals[i]<=0) {
					if (p.Registers[i<<1]>=SN.PSG_CUTOFF) {
						p.IntermediatePos[i] = ((p.NumClocksForSample-p.Clock+(p.ToneFreqVals[i]<<1))*p.ToneFreqPos[i]/(p.NumClocksForSample+p.Clock)*65536)|0;
						p.ToneFreqPos[i] = 0-p.ToneFreqPos[i];	// flip the flip-flop
					}
					else {
						p.ToneFreqPos[i] = 1;	// stuck value
						p.IntermediatePos[i] = null;
					}
					p.ToneFreqVals[i] += p.Registers[i<<1]*(p.NumClocksForSample/p.Registers[i<<1]+1);
				}
				else p.IntermediatePos[i] = null;
			}*/	// moved to buffer loop for speed
			if (p.ToneFreqVals[3]<=0) {	// noise channel
				p.ToneFreqPos[3] = 0-p.ToneFreqPos[3];	// flip the flip-flop
				if (p.NoiseFreq!==0x80)	// if not matching tone2, decrement counter
					p.ToneFreqVals[3] += p.NoiseFreq*(p.NumClocksForSample/p.NoiseFreq+1);
				if (p.ToneFreqPos[3]===1) {	// only once per cycle
					var Feedback = p.NoiseShiftRegister;	// int
					if (p.Registers[6]&0x4) {	// white noise
						switch (p.WhiteNoiseFeedback) {	// calculate parity of fed-back bits for feedback
							case 0x0003:
							case 0x0006:	// SC-3000, %00000110
							case 0x0009:	// SMS, GG, MD, %00001001
								Feedback = ((Feedback&p.WhiteNoiseFeedback)&&((Feedback&p.WhiteNoiseFeedback)^p.WhiteNoiseFeedback))?1:0;
								break;
							case 0x8005:	// BBC Micro, falls thru
							default:
								Feedback = Feedback&p.WhiteNoiseFeedback;
								Feedback ^= Feedback>>8;
								Feedback ^= Feedback>>4;
								Feedback ^= Feedback>>2;
								Feedback ^= Feedback>>1;
								Feedback &= 1;
								break;
						}
						//console.log('reg[6]='+p.Registers[6]+' (white), '+Feedback);
					}
					else {	// periodic noise
						Feedback = Feedback&1;
						//console.log('reg[6]='+p.Registers[6]+' (per), '+Feedback);
					}
					p.NoiseShiftRegister = (p.NoiseShiftRegister>>1)|(Feedback<<(p.NoiseShiftWidth-1));
				}
			}
			buf[n++] += vl*_sc;
			buf[n++] += vr*_sc;
			//p.ToneFreqVals[3] |= 0;
		}
		//console.log("***:"+fv.toString(', '));
		//console.log("***:"+nsr.toString(','));
	})(sn76489);
	return buf;
};
/* Toggle channel muting +neo */
S.prototype.toggle = function(ch,m) {sn76489.muted[ch] = !m;}

})(SN76489);

module.exports = { SN76489: SN76489 };
