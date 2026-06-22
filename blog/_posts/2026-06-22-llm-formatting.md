---
layout: post
title: "Impact of Serialisation Format on LLM Task Performance."
description: "A benchmark across four small models found the format effect everyone talks about mostly wasn't there. The task was the variable that mattered, and it broke in the same way for every model we tried."
date: 2026-06-22
author: Marigold
category: Engineering
reading_time: 7
canonical: "https://marigold.run/blog/format-vs-task/"
title: "Impact of Serialisation Format on LLM Task Performance."
og_description: "A benchmark across four small models found the format effect everyone talks about mostly wasn't there. The task was the variable that mattered."
schema: |
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "Format Doesn't Matter. The Task Does.",
    "description": "A benchmark across four small models found the format effect everyone talks about mostly wasn't there. The task was the variable that mattered, and it broke in the same way for every model we tried.",
    "datePublished": "2026-06-22",
    "dateModified": "2026-06-22",
    "author": { "@type": "Organization", "name": "Marigold" },
    "publisher": { "@type": "Organization", "name": "Marigold", "url": "https://marigold.run" },
    "mainEntityOfPage": { "@type": "WebPage", "@id": "https://marigold.run/blog/format-vs-task/" }
  }
  </script>
---

# Format Doesn't Matter. The Task Does.

A [recent piece on LLM data formatting](https://bayinformationsystems.substack.com/p/llm-data-formatting-choices-a-taxonomy) argues that swapping a prompt's data between JSON, XML, YAML, and CSV can move accuracy by 200-300% on the same task, and that format choice is one of the highest-leverage decisions in prompt design. We built a benchmark to test that directly, across four small open models. The format effect is real, but small and inconsistent. A different variable, the kind of question being asked, mattered far more, and it broke the same way for every model we tested.

## Motivation

The taxonomy's claim is specific enough to test: hold the data constant, vary only the serialisation, and measure accuracy. We wanted numbers across more than one model, since a finding that only holds for one architecture is a finding about that model, not about formats.

This also bears on how we built Marigold's workflow features: Where a workflow needs a lookup or a sum over structured data, we run that step in Python rather than asking the model to do arithmetic over serialised text.

## Methodology

A synthetic dataset of companies, each with a name, revenue, category, and a list of offices, gets rendered into five formats (JSON, XML, YAML, CSV, plain text) from the same underlying data, so any accuracy difference is attributable to format, not content. Three task types are asked of every format, at three dataset sizes (5, 25, and 100 companies):

- **Flat lookup**: "What is the revenue of Company_0014? Answer with only the number." One field, one record, no structure to traverse.
- **Nested lookup**: "For Company_0014, what is the city of its second office? Answer with only the city name." Finding the right record, then the right item inside a list belonging to that record.
- **Aggregation**: "What is the total revenue of all companies in the logistics category? Answer with only the number." Finding every record matching a filter, then summing a field across all of them.

Aggregation asks a model to do something known to be unreliable: arithmetic. The task tests two abilities at once, filtering the right rows and summing them, and a wrong answer doesn't say which one failed. The clearest evidence in our results is a row where the correct total was zero, because no companies matched the category, and the model returned a large, specific, wrong number anyway. Some of aggregation's failures are retrieval failures dressed as arithmetic.

Answers are scored by exact match against ground truth computed directly from the data, not by re-parsing the model's own output.

Four models ran the full sweep: Qwen2.5-1.5B-Instruct, Qwen2.5-3B-Instruct, Gemma-3-1B-IT, and Phi-4-mini-instruct, all served through Marigold on a single 6GB GPU. At the largest dataset size, a meaningful share of requests failed outright with a CUDA out-of-memory error before the model produced any answer, a hardware result covered below. Every accuracy figure that follows excludes those failed calls from its denominator. A request that never completed is different from a wrong answer.

Code and full results: [github.com/bayinfosys/marigold-benchmarks](https://github.com/bayinfosys/marigold-benchmarks), under `llm-formating`.

## Results

**Aggregation fails past a trivial dataset size, for every model, regardless of format.** At 25 and 100 companies, all four models scored exactly zero correct on "total revenue for category X", out of 90 to 120 attempts each:

| Model | Correct (medium + large) | Attempted |
|---|---|---|
| Qwen2.5-1.5B | 0 | 90 |
| Qwen2.5-3B | 0 | 90 |
| Gemma-3-1B | 0 | 120 |
| Phi-4-mini | 0 | 90 |

Changing serialisation method had no effect on the error; every format failed at the same rate.

**Flat lookup mostly holds up once dataset size doesn't cause an outright failure.** At small and medium sizes, three of the four models score 96-100% regardless of format. The exception is Gemma-3-1B, which drops to 20% accuracy at the largest size among the requests it completed.

**The format effect the taxonomy describes shows up only on nested lookups, and for only one of the four models.** Restricting to dataset sizes where every format had a fair, complete sample:

| Model | CSV | JSON | XML | YAML | Plain text |
|---|---|---|---|---|---|
| Qwen2.5-1.5B | 14/18 | 11/18 | 7/18 | 11/18 | 6/18 |
| Qwen2.5-3B | 15/18 | 15/18 | 15/18 | 15/18 | 15/18 |
| Gemma-3-1B | 7/18 | 9/18 | 11/18 | 7/18 | 9/18 |
| Phi-4-mini | 9/18 | 12/18 | 12/18 | 15/18 | 12/18 |

Qwen2.5-1.5B shows a real CSV advantage on this task. Qwen2.5-3B, the same family one size up, shows no format effect at all: identical scores across every format. Gemma and Phi-4-mini each have their own best and worst formats, agreeing with neither Qwen's pattern nor each other. The format effect here is small, inconsistent across models, and doesn't generalise into a rule like "use CSV for nested data." It reads as an artefact of how one model's tokenizer or attention handles one structure, not a property of the formats themselves.

**OOM errors based on prompt length** At the largest dataset size, three of the four models failed 80% of requests with a CUDA out-of-memory error during prefill, before generating any answer; Gemma-3-1B failed 40% of the time under the same conditions. The failure relates to the length of the prompt, not the model's parameter count: Phi-4-mini's attention computation requested roughly 2.5 times more memory than Qwen's or Gemma's for a comparably sized prompt, consistent with a different attention head configuration costing more per token of context, independent of overall model size. On a 6GB card, fitting the model and completing every prompt sent to it are different claims, and the gap between them varies by model for reasons unrelated to how well that model completes the task.

## Conclusion

The taxonomy's central claim, that format choice routinely swings accuracy by 200-300%, didn't hold as a general rule across the four models we tested. We saw it once, in one model, on one task type; the same family one size up showed no format effect on the identical task. What we found instead was a task effect, consistent across every model: simple lookups work, nested lookups are inconsistent and model-specific, and aggregation fails completely past a handful of rows, for reasons unrelated to serialisation.

Marigold's workflow engine performs lookup and arithmetic in `json-logic` rather than by model. This article helps justify that design decision.
