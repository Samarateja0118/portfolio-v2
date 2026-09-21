# portfolio-v2

A second portfolio, built around one idea rather than a list of projects.

Every project here is about the same thing: something in the system cannot be
trusted — a language model, a government API, a node that stops answering — and
the work is deciding in advance how it fails. So the page is built that way too.

**Colour is the grammar.** The whole site is bone-white on near-black. The one
warm colour, `--signal`, appears *only* where something fails: a poisoned record
caught at a gate, a chunk that had to fall back to its second-choice node, a
forecast that was confidently wrong, a reply the guardrails refused to send.
Nothing decorative is ever allowed to use it.

## The scene

One `three.js` scene, four stations, one camera riding the scroll. Each station
is that project's actual failure mode, running live:

| Station | Shows |
|---|---|
| Access AI Gateway | Records streaming at a boundary; the one carrying an instruction is caught *at* the gate, not downstream |
| Distributed Object Storage | Chunks scored against five nodes by rendezvous hashing; a node drops and the write walks down the ranking |
| Polymarket Forecast Benchmark | Forecasts against the diagonal of perfect calibration, settling onto a bowed, overconfident curve |
| SOP-Guided Claims Agent | Four phase gates in fixed order; a reply that breaks one is discarded and replaced by a computed line |

## Running it

Static files, no build step:

```bash
python3 -m http.server 8799
```

## Notes for whoever touches this next

- **The scene is optional.** It is gated on viewport width, `prefers-reduced-motion`
  and WebGL support, loads after the page is usable, and every failure path leaves
  a working page. The loader has a hard 4s timeout so a stalled dependency can
  never hold the page hostage.
- **`#scene` has explicit `width`/`height`.** A canvas is a replaced element: with
  `width:auto`, `inset:0` resolves to its intrinsic pixel-buffer size — DPR times
  the viewport — not to the viewport.
- **Camera damping clamps `dt` generously (0.3s).** A tight clamp leaves the camera
  stranded several stations behind the scroll when `requestAnimationFrame` is
  throttled, which browsers do freely in background or occluded tabs.
- **Camera anchors mirror the panels.** An object appears on the *right* of frame
  when the camera looks to the *left* of it. The panels alternate right/left down
  the page, so the anchors alternate the other way and text never sits on top of
  the scene.
