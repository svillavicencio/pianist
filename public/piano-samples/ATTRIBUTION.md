# Piano sample attribution

This directory contains the 641 MP3 assets accepted from the browser adaptation
at commit `0cd2c034f820c53e83ab22f5c13bd490b9e4de85`:
`https://github.com/tambien/Piano` (pinned source archive).

Two distinct obligations apply:

- **Adaptation code:** `tambien/Piano` is MIT licensed; retain its copyright and
  license notice for the conversion/packaging code.
- **Audio:** the derived Salamander Yamaha C5 recordings are by Alexander Holm
  and are CC BY 3.0: <https://creativecommons.org/licenses/by/3.0/>. The original
  authority is <https://github.com/sfzinstruments/SalamanderGrandPiano>.
  Attribution is retained for Alexander Holm and the Yamaha C5 recording.

The bank contains 480 attacks (30 anchors × 16 layers), 88 releases, 69
harmonics, and 4 pedal files. The assets are MP3 conversions supplied by the
pinned adaptation and are validated by `npm run validate:piano-assets`; the
validator checks 641 files and exactly 90,413,373 bytes plus SHA-256 metadata.
Pedal files are packaged and attributed but are not audibly activated because
the application has no valid pedal event source. No round-robin behavior is
claimed.

Verification date: 2026-09-14. Evidence: pinned archive checkout,
deterministic intake output, and committed-file SHA-256/byte validation.
