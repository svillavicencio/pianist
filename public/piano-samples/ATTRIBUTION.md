# Piano sample attribution

The `.flac` files in this directory are individual note recordings from the
**Salamander Grand Piano V3** sample library.

- Author: Alexander Holm
- Source: https://github.com/sfzinstruments/SalamanderGrandPiano
- License: [Creative Commons Attribution 3.0 Unported (CC-BY 3.0)](https://creativecommons.org/licenses/by/3.0/)
- Recording: Yamaha C5 grand piano, two AKG C414 microphones, 48kHz/24-bit
  (files here are the original individual note samples, unmodified).

Only 8 of the 641 available note/velocity files were taken — one velocity
layer (`v8`) at every recorded pitch (`A`/`C`, every minor third) from `C2`
to `A5` — to cover a usable pitch range for `WebAudioEngine`'s pitch-shift
based sampler (see `src/adapters/web/audio/sampleSelection.ts`).

Per the CC-BY 3.0 license, any distribution of this project (including this
repository) must carry this attribution.
