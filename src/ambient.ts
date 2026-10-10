// An original, seamless ten-second ambient bed synthesized in the browser.
// No external audio file, network request or third-party license is needed.
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
      const sampleRate=this.context.sampleRate;
      const length=sampleRate*10;
      const buffer=this.context.createBuffer(2,length,sampleRate);
      // All oscillators complete an integer number of cycles per 10s loop.
      // Slight stereo detuning and gentle slow modulation create a space pad.
      for(let channel=0;channel<2;channel++){
        const samples=buffer.getChannelData(channel);
        for(let i=0;i<length;i++){
          const t=i/sampleRate;
          const drift=Math.sin(2*Math.PI*.1*t+(channel?.7:0));
          const swell=.78+.22*Math.cos(2*Math.PI*.2*t);
          const base=Math.sin(2*Math.PI*55*t+(channel?.35:0));
          const fifth=Math.sin(2*Math.PI*82.5*t+(channel?.2:0));
          const high=Math.sin(2*Math.PI*110.1*t+(channel?.5:0));
          const shimmer=Math.sin(2*Math.PI*220.2*t+(channel?.8:0));
          samples[i]=(base*.27+fifth*.17+high*.11+shimmer*.025)*(swell+.05*drift);
        }
      }
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
    this.gain!.gain.setTargetAtTime(.22,now,.7);
    this.enabled=true;
    return true;
  }
}
