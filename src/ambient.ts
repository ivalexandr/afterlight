// Original 32-second ambient score, synthesized locally with Web Audio.
// No downloaded samples or third-party music licenses.
const DURATION=32;
const TAU=Math.PI*2;
const midi=(note:number)=>440*Math.pow(2,(note-69)/12);
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};

type Note={midi:number;start:number;length:number;volume:number;kind:'pad'|'bell'|'bass';pan:number};

function compose():Note[]{
  const notes:Note[]=[];
  // D minor -> Bbmaj7 -> Fadd9 -> Csus2 / C, returning gently to Dm.
  const chords=[
    {bass:38,pad:[50,57,62,65,69]},
    {bass:34,pad:[50,57,62,65,69]},
    {bass:41,pad:[53,57,60,67,72]},
    {bass:36,pad:[48,55,60,62,67]}
  ];
  chords.forEach((chord,i)=>{
    const start=i*8;
    notes.push({midi:chord.bass,start,length:9.5,volume:.12,kind:'bass',pan:0});
    chord.pad.forEach((note,j)=>notes.push({midi:note,start:start+j*.13,length:9.4,volume:.027,kind:'pad',pan:(j-2)*.22}));
  });
  // A recognizable, slow two-part motif with an answer and a soft resolution.
  const melody=[
    [0,74,2.5],[3,77,2.8],[6,76,2.5],
    [8,74,2.6],[11,72,2.8],[14,69,2.5],
    [16,72,2.5],[19,76,2.8],[22,79,2.4],
    [24,77,2.3],[26.5,76,2.2],[29,74,2.8]
  ];
  melody.forEach(([start,note,length],i)=>{
    notes.push({midi:note,start,length,volume:.105,kind:'bell',pan:i%2===0?-.42:.42});
  });
  // Tiny high-register stars, not a rhythmic percussion track.
  [[4,86],[12,84],[20,88],[28,81]].forEach(([start,note],i)=>{
    notes.push({midi:note,start,length:3.6,volume:.024,kind:'bell',pan:i%2?-.65:.65});
  });
  return notes;
}

function makeScore(context:AudioContext):AudioBuffer{
  const rate=context.sampleRate;
  const length=Math.round(DURATION*rate);
  const buffer=context.createBuffer(2,length,rate);
  const channels=[buffer.getChannelData(0),buffer.getChannelData(1)];
  const notes=compose();
  const add=(channel:Float32Array,note:Note,panGain:number,delay:number,echoGain:number)=>{
    const frequency=midi(note.midi);
    const total=note.length+(note.kind==='bell'?4.2:1.8);
    const start=Math.round((note.start+delay)*rate);
    const count=Math.ceil(total*rate);
    const step=TAU*frequency/rate;
    for(let i=0;i<count;i++){
      const t=i/rate;
      let env:number;
      let tone:number;
      if(note.kind==='bell'){
        env=(1-Math.exp(-t*8))*Math.exp(-t/2.35);
        tone=Math.sin(step*i)+.21*Math.sin(step*i*2.005)+.08*Math.sin(step*i*3.01);
      }else if(note.kind==='pad'){
        const release=smooth((total-t)/1.8);
        env=smooth(t/2.2)*release;
        tone=.72*Math.sin(step*i)+.22*Math.sin(step*i*2.002)+.09*Math.sin(step*i*3);
        tone*=.92+.08*Math.sin(TAU*.16*t);
      }else{
        env=smooth(t/1.7)*smooth((total-t)/2);
        tone=.88*Math.sin(step*i)+.12*Math.sin(step*i*2);
      }
      const index=(start+i)%length;
      channel[index]+=tone*env*note.volume*panGain*echoGain;
    }
  };
  for(const note of notes){
    const left=Math.sqrt((1-note.pan)/2);
    const right=Math.sqrt((1+note.pan)/2);
    add(channels[0],note,left,0,1);
    add(channels[1],note,right,0,1);
    if(note.kind==='bell'){
      // Long, quiet stereo echoes, wrapped into the seamless loop.
      add(channels[0],note,right, .48,.27);
      add(channels[1],note,left, .64,.24);
      add(channels[0],note,left, 1.21,.12);
      add(channels[1],note,right, 1.36,.12);
    }
  }
  // Gentle saturation and a periodic 32s gain contour avoid clicks at the seam.
  for(let c=0;c<2;c++){
    const data=channels[c];
    for(let i=0;i<length;i++){
      const t=i/rate;
      const breath=.94+.06*Math.cos(TAU*t/DURATION);
      data[i]=Math.tanh(data[i]*1.18)*breath*.86;
    }
    // Crossfade the last 100ms into the first 100ms for a continuous boundary.
    const fade=Math.round(rate*.1);
    for(let i=0;i<fade;i++){
      const blend=smooth(i/fade);
      const tail=data[length-fade+i];
      const head=data[i];
      const shared=tail*(1-blend)+head*blend;
      data[length-fade+i]=tail*(1-blend)+shared*blend;
      data[i]=shared*(1-blend)+head*blend;
    }
  }
  return buffer;
}

export class AmbientSound {
  private context:AudioContext|null=null;
  private source:AudioBufferSourceNode|null=null;
  private gain:GainNode|null=null;
  private enabled=false;
  get playing(){return this.enabled;}
  async toggle():Promise<boolean>{
    if(this.enabled){
      this.enabled=false;
      if(this.context&&this.gain){
        const now=this.context.currentTime;
        this.gain.gain.cancelScheduledValues(now);
        this.gain.gain.setTargetAtTime(0,now,.35);
      }
      return false;
    }
    if(!this.context){
      this.context=new AudioContext();
      const buffer=makeScore(this.context);
      this.gain=this.context.createGain();
      this.gain.gain.value=0;
      this.gain.connect(this.context.destination);
      this.source=this.context.createBufferSource();
      this.source.buffer=buffer;
      this.source.loop=true;
      this.source.connect(this.gain);
      this.source.start();
    }
    await this.context.resume();
    const now=this.context.currentTime;
    this.gain!.gain.cancelScheduledValues(now);
    this.gain!.gain.setTargetAtTime(.7,now,.8);
    this.enabled=true;
    return true;
  }
}
