---
layout: post
title: "Local LLM Serving on a £170 GPU: vLLM, Ollama, and Marigold Compared"
description: "Three serving stacks, one model, one cheap GPU. A 14.7x speedup in our own code, and a VRAM problem most benchmarks don't mention."
date: 2026-06-22
author: Marigold
category: Engineering
reading_time: 6
canonical: "https://marigold.run/blog/llm-providers/"
og_title: "Local LLM Serving on a £170 GPU: vLLM, Ollama, and Marigold Compared"
og_description: "Three serving stacks, one model, one cheap GPU. A 14.7x speedup, and a VRAM problem most benchmarks don't mention."
schema: |
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "Local LLM Serving on a £170 GPU: vLLM, Ollama, and Marigold Compared",
    "description": "Three serving stacks, one model, one cheap GPU. A 14.7x speedup in our own code, and a VRAM problem most benchmarks don't mention.",
    "datePublished": "2026-06-22",
    "dateModified": "2026-06-22",
    "author": { "@type": "Organization", "name": "Marigold" },
    "publisher": { "@type": "Organization", "name": "Marigold", "url": "https://marigold.run" },
    "mainEntityOfPage": { "@type": "WebPage", "@id": "https://marigold.run/blog/cheap-gpu-serving/" }
  }
  </script>
---

# Local LLM serving on a £170 GPU: vLLM, Ollama, and Marigold compared

A 6GB Nvidia GPU costs about £170. A 32GB card costs around £3,000: eighteen times the price for five times the memory. VRAM almost completely explains the price difference in Nvidia devices.

A 1-2B model fits in 6GB comfortably. The real question is: what happens once more than one request hits? We ran the same model through three serving stacks on identical 6GB hardware to find out.

## Motivation

Serving frameworks differ enormously in how they handle concurrency, and on cheap hardware that difference decides whether the card is useful for anything beyond one interactive session. We also wanted an honest number for our own stack, Marigold, against Ollama (the default for local development) and vLLM (the default for production). Marigold runs inference through plain HuggingFace Transformers rather than a dedicated serving engine.

## Methodology

Ollama, vLLM, and Marigold each served Qwen2.5-1.5B-Instruct on the same physical GPU, one provider at a time. vLLM and Ollama used adaptive quantisation builds, Marigold the model loaded directly via Transformers with static 4 bit quantisation.

86 prompts, four concurrency levels (1, 4, 8, 16 simultaneous requests), three repeats each, 1032 calls per provider. The harness enforced concurrency itself, firing N requests at once via a thread pool, rather than trusting each server's internal batching to self-report. Each provider's first request is excluded below as a one-off cold-load cost.

Marigold's endpoint doesn't support streaming, so time-to-first-token is unavailable. That column is left blank rather than estimated; total duration is the fair comparison in its place.

Code and full results: [github.com/bayinfosys/marigold-providers](https://github.com/bayinfosys/marigold-providers), under `llm-providers`.

## Results

Median figures, cold start excluded:

| Provider | TTFT (s) | Total duration (s) | Tokens/sec | Sec/token |
|---|---|---|---|---|
| vLLM | 0.063 | 1.449 | 54.77 | 0.0183 |
| Ollama | 1.528 | 2.196 | 39.03 | 0.0256 |
| Marigold | — (see total duration) | 8.015 | 11.58 | 0.0864 |

vLLM wins every column. More informative is how throughput moves with concurrency:

| Provider | Tokens/sec at concurrency 1 | Tokens/sec at concurrency 16 | Ratio |
|---|---|---|---|
| vLLM | 56.8 | 51.4 | 1.1x slower |
| Ollama | 99.5 | 14.0 | 7.1x slower |
| Marigold | 26.9 | 4.4 | 6.1x slower |

vLLM stays nearly flat: continuous batching, requests processed together rather than queued. Ollama and Marigold both drop by roughly six to seven times over the same range: no batching, just different starting points.

Marigold's starting point is its own result. An earlier pass measured it at roughly 2.5 tokens/second, identical between a 1.5B and a 3B model, which ruled out raw compute as the bottleneck and pointed at the serving code itself. Switching the attention implementation from eager to PyTorch's native `sdpa` closed most of that gap alone: 2.5 to roughly 37 tokens/second on the 1.5B model, a 14.7x improvement from one configuration change, same model, same hardware, same requests. `sdpa` runs on any GPU generation; FlashAttention2, the usual alternative, needs compute capability 8.0 or above (Ampere onward), so it's not available on older Turing-class cards, which is exactly the territory a £170 GPU sits in. The fix bought speed, not batching, which is why Marigold still degrades under concurrency the way Ollama does, just from a faster starting point now.

The other result has nothing to do with any one provider. Every framework tested defaults to greedy VRAM allocation: all backends try to claim a large share of memory at startup, on the assumption that the GPU is theirs alone. On a 6GB card, whichever server starts second fails to allocate. Every comparison here ran sequentially, one provider stopped before the next started, because there was no other way to do it on this hardware.

## Conclusion

vLLM is the right choice past single-user use, holding throughput flat as concurrency rises. "Single-user" doesn't mean one human typing into a chat window: a coding agent issuing several tool calls in parallel, or a pipeline running multiple sub-tasks at once, is concurrent load on the same model, whoever or whatever is asking. Ollama suits genuinely single-request, single-session development and degrades predictably under load. Marigold's plain-Transformers backend, once the attention kernel was fixed, became competitive in absolute speed but still lacks batching.
