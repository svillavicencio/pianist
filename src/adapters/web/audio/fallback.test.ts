import { describe, expect, it } from 'vitest';
import { WebAudioEngine } from './WebAudioEngine';
import { createPianoSampleProvider } from './realPianoSamples';
const context={createGain:()=>({gain:{value:0},connect(){},disconnect(){}}),createDynamicsCompressor:()=>({threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect(){},disconnect(){}}),destination:{}} as unknown as BaseAudioContext;
describe('sampler fallback',()=>{it('delegates unavailable notes and records legacy-fallback',()=>{let calls=0;const legacy={init:async()=>{},noteOn:()=>{calls++;return {release(){}}}};const provider={loader:{} as any,prewarmBootstrap:async()=>{},prewarmPiece:async()=>{},getAttack:()=>undefined,getRelease:()=>undefined};const engine=new WebAudioEngine(context,provider,{legacyFallback:legacy});engine.noteOn(60,100);expect(calls).toBe(1);expect(engine.diagnostics().legacyFallbacks).toBe(1);});});

class LegacyParam { value=0; cancelScheduledValues(){} setValueAtTime(v:number){this.value=v;return this;} linearRampToValueAtTime(){return this;} }
class LegacySource { buffer:any; playbackRate=new LegacyParam(); onended=()=>{}; connect(){return this;} start(){} stop(){} }
class LegacyGain { gain=new LegacyParam(); connect(){return this;} disconnect(){} }
class LegacyCompressor extends LegacyGain { threshold=new LegacyParam(); knee=new LegacyParam(); ratio=new LegacyParam(); attack=new LegacyParam(); release=new LegacyParam(); }
class LegacyContext {
 currentTime=0; destination={}; sources:LegacySource[]=[]; compressor=new LegacyCompressor();
 createBufferSource(){const s=new LegacySource();this.sources.push(s);return s;}
 createGain(){return new LegacyGain();}
 createDynamicsCompressor(){return this.compressor;}
}
describe('end-to-end fallback boundary with real components',()=>{
 it('a real unwarmed sampler provider routes noteOn to a real legacy WebAudioEngine and records legacy-fallback',async()=>{
  const samplerContext=new LegacyContext();
  const samplerProvider=createPianoSampleProvider(samplerContext as unknown as BaseAudioContext,'/pianist/',{
   fetchImpl:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}) as unknown as Response,
   decode:async()=>({length:1,numberOfChannels:1}) as AudioBuffer,
  });
  // No prewarm/decode has happened yet, so the real provider genuinely has
  // no compatible loaded attack for this note.
  const legacyContext=new LegacyContext();
  const legacyEngine=new WebAudioEngine(
   legacyContext as unknown as BaseAudioContext,
   new Map([[60,{id:'legacy-buffer'} as unknown as AudioBuffer]]),
  );
  const engine=new WebAudioEngine(samplerContext as unknown as BaseAudioContext,samplerProvider,{legacyFallback:legacyEngine});
  engine.noteOn(60,100);
  expect(legacyContext.sources).toHaveLength(1);
  expect(engine.diagnostics().legacyFallbacks).toBe(1);
  expect(engine.diagnostics().audioStatus).toBe('legacy-fallback');
 });
 it('a real unwarmed sampler provider without a legacy fallback reports an observable audio error', async () => {
  const samplerContext=new LegacyContext();
  const samplerProvider=createPianoSampleProvider(samplerContext as unknown as BaseAudioContext,'/pianist/',{
   fetchImpl:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}) as unknown as Response,
   decode:async()=>({length:1,numberOfChannels:1}) as AudioBuffer,
  });
  const engine=new WebAudioEngine(samplerContext as unknown as BaseAudioContext,samplerProvider);
  const statuses:string[]=[];
  engine.subscribeStatus((status)=>statuses.push(status));
  expect(()=>engine.noteOn(60,100)).toThrow(/no-compatible-asset/);
  expect(statuses).toContain('audio-error');
  expect(engine.diagnostics().audioStatus).toBe('audio-error');
 });
});
