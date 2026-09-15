import { describe, expect, it } from 'vitest';
import { PIANO_MANIFEST } from './pianoAssetManifest';
import { createPianoSampleProvider, harmonicAssetFor } from './realPianoSamples';
import { WebAudioEngine } from './WebAudioEngine';
describe('manifest-backed harmonics',()=>{it('maps a supported anchor and velocity to a real harmonic asset',()=>{const asset=harmonicAssetFor(21,127);expect(asset?.role).toBe('harmonic');expect(asset?.id).toMatch(/^harm/);expect(PIANO_MANIFEST.assets).toContain(asset);});it('reports unsupported harmonic ranges without fabricating IDs',()=>{expect(harmonicAssetFor(108,64)).toBeUndefined();});});

class Param { value=0; cancelScheduledValues(){} setValueAtTime(v:number){this.value=v;return this;} linearRampToValueAtTime(v:number){return this;} }
class Source { buffer:any; playbackRate=new Param(); onended=()=>{}; connect(){return this;} start(){} stop(){} }
class Gain { gain=new Param(); connect(){return this;} disconnect(){} }
class Compressor extends Gain { threshold=new Param(); knee=new Param(); ratio=new Param(); attack=new Param(); release=new Param(); }
class FakeContext {
 currentTime=0; destination={}; sources:Source[]=[]; compressor=new Compressor();
 createBufferSource(){const s=new Source();this.sources.push(s);return s;}
 createGain(){return new Gain();}
 createDynamicsCompressor(){return this.compressor;}
}
describe('end-to-end harmonic routing through the real provider and engine',()=>{
 it('a note that was prewarmed with its piece triggers a real, manifest-resolved harmonic voice',async()=>{
  const context=new FakeContext();
  const provider=createPianoSampleProvider(context as unknown as BaseAudioContext,'/pianist/',{
   fetchImpl:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}) as unknown as Response,
   decode:async()=>({length:1,numberOfChannels:1}) as AudioBuffer,
  });
  await provider.prewarmBootstrap([21]);
  await new Promise((resolve)=>setTimeout(resolve,20));
  const engine=new WebAudioEngine(context as unknown as BaseAudioContext,provider);
  engine.noteOn(21,100);
  // One source for the attack voice, one for the routed harmonic voice —
  // both resolved through the real manifest/provider pipeline, not a fake.
  expect(context.sources).toHaveLength(2);
 });
 it('a note outside the supported harmonic range never fabricates a harmonic voice',async()=>{
  const context=new FakeContext();
  const provider=createPianoSampleProvider(context as unknown as BaseAudioContext,'/pianist/',{
   fetchImpl:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}) as unknown as Response,
   decode:async()=>({length:1,numberOfChannels:1}) as AudioBuffer,
  });
  await provider.prewarmBootstrap([108]);
  await new Promise((resolve)=>setTimeout(resolve,20));
  const engine=new WebAudioEngine(context as unknown as BaseAudioContext,provider);
  engine.noteOn(108,64);
  expect(context.sources).toHaveLength(1);
 });
});
