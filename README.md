<div align="center">

# awesome-open-tts-under-1b

**Every open-weight TTS model under 1B parameters <br> with the applied numbers you need to pick a local model for a voice agent.**

[![Awesome](https://awesome.re/badge.svg)](https://awesome.re)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](#contributing)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

</div>

Small open TTS models have crossed a line: several now stream in real time on a CPU, and the under-1B tier is where "runs on my machine" stops being a hope and starts being a spec. This list exists for one reader: a developer choosing a local TTS model for a real application (a LiveKit or Pipecat agent, an offline device, a self-hosted API) who needs the applied numbers, not a research survey.

**What this list is.** A neutral registry. Every open-weight model under 1B parameters gets a row. No rankings, no editor's pick, no "best" column. The table gives you the facts that change the decision; you weigh them for your build.

**What this list is not.** A benchmark we run ourselves. Every number here is compiled from the internet and carries a source link plus a hardware note. Latency numbers are not comparable across rows unless the hardware matches, and the table never pretends otherwise.

---

## Model Lists: shippable today

| Model                                                        | Params                         | License                | Languages                            | Streaming                                      | TTFB / first-chunk                                                                  | CPU real-time                             | Quantized formats                          | Integration path                                                                                                          |
| ------------------------------------------------------------ | ------------------------------ | ---------------------- | ------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| [Kitten TTS](https://github.com/KittenML/KittenTTS)          | 15M to 80M                     | Apache 2.0             | English                              | Output-streaming (chunked)                     | not published                                                                       | yes                                       | ONNX (ships as ONNX)                       | DIY; ONNX runs in-browser and on edge                                                                                     |
| [Kokoro](https://github.com/hexgrad/kokoro)                  | 82M                            | Apache 2.0             | 8 languages, 54 voices               | Output-streaming (chunked)                     | not published (community reports sub-second full-utterance on CPU; hardware varies) | yes                                       | ONNX community exports                     | Pipecat service available; community LiveKit wrappers; verify plugin freshness                                            |
| [MeloTTS](https://github.com/myshell-ai/MeloTTS)             | under 1B (VITS-based)          | MIT                    | En (4 accents), Es, Fr, Zh, Ja, Ko   | No native streaming; sentence-chunk workaround | not published                                                                       | yes                                       | not published                              | DIY; simple Python API                                                                                                    |
| [StyleTTS 2](https://github.com/yl4579/StyleTTS2)            | under 1B                       | MIT                    | English (single and multi-speaker)   | No native streaming                            | not published                                                                       | borderline                                | community ONNX efforts                     | DIY                                                                                                                       |
| [Chatterbox](https://github.com/resemble-ai/chatterbox)      | ~0.5B                          | MIT (code and weights) | 23 languages (Multilingual v3)       | Output-streaming                               | low latency claimed for Turbo variant (vendor; hardware unspecified)                | borderline                                | not published                              | Community wrappers; built-in PerTh watermarking                                                                           |
| [CosyVoice 2](https://github.com/FunAudioLLM/CosyVoice)      | 0.5B                           | Apache 2.0             | Zh, En, + others; cross-lingual mode | Dual-capable chunk-aware streaming             | ~150 ms first-chunk ([vendor paper](https://arxiv.org/abs/2412.10117); GPU)         | no                                        | not published                              | Community wrappers                                                                                                        |
| [NeuTTS Air](https://github.com/neuphonic/neutts-air)        | under 1B (0.5B-class backbone) | Apache 2.0             | English                              | Output-streaming                               | not published                                                                       | yes (GGUF on-device is the design target) | GGUF                                       | DIY; built for edge                                                                                                       |
| [Parler-TTS Mini](https://github.com/huggingface/parler-tts) | 880M                           | Apache 2.0             | English                              | Output-streaming supported                     | not published                                                                       | no                                        | not published                              | DIY; HF Transformers native                                                                                               |
| [Sesame CSM-1B](https://github.com/SesameAILabs/csm)         | 1B (boundary case, see rule 1) | Apache 2.0             | English                              | Conversational, context-conditioned generation | not published                                                                       | no                                        | community quantized variants exist; verify | Community wrappers                                                                                                        |
| [Piper](https://github.com/OHF-Voice/piper1-gpl)             | tens of M per voice            | GPL v3                 | Many languages, per-language voices  | Sentence-level streaming                       | not published                                                                       | yes                                       | ONNX (ships as ONNX)                       | DIY; the default for Home Assistant and Raspberry Pi. GPL v3: fine to run as a service, read the license for distribution |

## Contributing

PRs welcome. The bar:

- New model rows: open weights, under 1B strictly (rule 1), active in the last 12 months, all columns filled or marked not published.
- Benchmark numbers: must include a source link, the hardware, and the vendor or community tag. Numbers without provenance are declined in review, whichever direction they point.
- License corrections: highest-priority PRs. Licenses move; a wrong label here does real damage.
- Removals: models inactive over 12 months move to an Archive section via PR, with the reason noted.

Open an issue first for anything ambiguous, especially boundary parameter counts.

---

## The rules

These are the inclusion and honesty rules. Every PR is checked against them.

1. **Under 1B parameters, strictly.** The published parameter count of the released checkpoint must be below 1,000M. One boundary exception is grandfathered in: **Sesame CSM-1B sits exactly at 1B and is included as the named boundary case.** Nothing else at or above 1B gets a row.
2. **Open weights you can download today.** A model earns a row only if the weights are publicly downloadable now, not gated behind a waitlist or a demo API.
3. **License is reported, not judged.** Non-commercial and restricted-weight models are listed, in their own table, with the restriction stated plainly. We do not exclude them and we do not bury the restriction in a footnote.
4. **Every number carries a source and a hardware tag.** Format: value (tag, hardware) with a link. Tags are **vendor** (published by the model's authors) or **community** (measured and published by a third party). A cell with no defensible source says **not published**. An honest gap beats a confident guess.
5. **Active within the last 12 months.** Repo commits, releases, or maintained forks count. Abandoned models move to the Archive section rather than being deleted, so the history stays useful.
6. **Neutral tone.** Descriptions state what a model does and what it needs. Marketing adjectives are removed in review.

---

## How to read the table

- **Streaming** tells you whether the model can emit audio before finishing the full utterance, and the mode where known. **Output-streaming** returns chunks but needs full text up front. **Dual-streaming** accepts text token-by-token while emitting audio, which is what hides TTS latency inside LLM generation in an agent.
- **TTFB / first-chunk** is time to first audio. This is the number that governs agent use. It is meaningless without the hardware note attached to it.
- **CPU real-time** is a three-value column: **yes** (community consensus that it runs faster than real time on a modern consumer CPU), **borderline** (real time only with quantization or short utterances), **no** (GPU required for real-time use).
- **Integration path** answers the question most lists skip: is there a maintained LiveKit or Pipecat plugin, a community wrapper, or are you writing the glue yourself. For agent builders this is often the deciding column.
