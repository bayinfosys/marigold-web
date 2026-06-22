---
layout: post
title: "Format Doesn't Matter. The Task Does."
description: "A benchmark across four small models found the format effect everyone talks about mostly wasn't there. The task was the variable that mattered, and it broke in the same way for every model we tried."
date: 2026-06-22
author: Marigold
category: Engineering
reading_time: 7
canonical: "https://marigold.run/blog/format-vs-task/"
og_title: "Format Doesn't Matter. The Task Does."
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

A [recent piece on LLM data formatting](https://bayinformationsystems.substack.com/p/llm-data-formatting-choices-a-taxonomy) argues that swapping a prompt's data between JSON, XML, YAML, and CSV can move accuracy by 200-300% on the same task, and that picking the right format is one of the highest-leverage decisions in prompt design. We built a benchmark to test that claim directly, across four small open models. The format effect is real, but small and inconsistent. A different variable, the kind of question being asked, turned out to matter far more, and it broke the same way for every model we tested.

## Motivation

The taxonomy's claim is specific enough to test: hold the data constant, vary only the serialisation, and measure accuracy. We wanted real numbers, not anecdote, and we wanted them across more than one model, since a finding that only holds for one architecture isn't a finding about formats, it's a finding about that model.

This also bears directly on how we build Marigold's workflow features. Where a workflow needs a lookup or a sum over structured data, we run that step in Python rather than asking the model to do arithmetic over serialised text. If the failure mode below is real and general, that design choice is doing more work than we'd assumed, and the format question becomes secondary to a more basic one: which operations should never be the model's job in the first place.

## Methodology

A synthetic dataset of companies, each with a name, revenue, category, and a list of offices, gets rendered into five formats (JSON, XML, YAML, CSV, plain text) from the same underlying data, so any accuracy difference is attributable to format, not content. Three task types are asked of every format, at three dataset sizes (5, 25, and 100 companies):

- **Flat lookup**: "What is the revenue of Company_0014? Answer with only the number." One field, one record, no structure to traverse.
- **Nested lookup**: "For Company_0014, what is the city of its second office? Answer with only the city name." Requires finding the right record, then the right item inside a list belonging to that record.
- **Aggregation**: "What is the total revenue of all companies in the logistics category? Answer with only the number." Requires finding every record matching a filter, then summing a field across all of them.

Aggregation needs a specific justification, because it asks a model to do something it's already known to be unreliable at: arithmetic. That's deliberate, not an oversight, but it means the task tests two abilities at once, filtering the right rows and summing them, and a wrong answer doesn't say which one failed. The clearest evidence in our results is a row where the correct total was zero, because no companies matched the category, and the model still returned a large, specific, wrong number. That's not a rounding error or an off-by-one sum; the model never correctly identified that the category was empty. Whatever else aggregation is measuring, at least some of its failures are retrieval failures wearing an arithmetic costume, and that's the more interesting half of the result.

Answers are scored by exact match against ground truth computed directly from the data, not by re-parsing the model's own output.

Four models ran the full sweep: Qwen2.5-1.5B-Instruct, Qwen2.5-3B-Instruct, Gemma-3-1B-IT, and Phi-4-mini-instruct, all served through Marigold on a single 6GB GPU. At the largest dataset size, a meaningful share of requests failed outright with a CUDA out-of-memory error before the model produced any answer, a hardware result in its own right, covered below. Every accuracy figure that follows excludes those failed calls from its denominator: a request that never completed is a different outcome from one that completed and got the wrong answer, and collapsing the two would understate how well these models do once they actually have the prompt in front of them.

Code and full results: [github.com/bayinfosys/marigold-providers](https://github.com/bayinfosys/marigold-providers), under `format-bench`.

## Results

**Aggregation fails past a trivial dataset size, for every model, regardless of format.** At 25 and 100 companies, all four models scored exactly zero correct on "total revenue for category X", out of 90 to 120 attempts each:

| Model | Correct (medium + large) | Attempted |
|---|---|---|
| Qwen2.5-1.5B | 0 | 90 |
| Qwen2.5-3B | 0 | 90 |
| Gemma-3-1B | 0 | 120 |
| Phi-4-mini | 0 | 90 |

Format never enters into it. Whether that's the arithmetic, the row-filtering, or both, switching serialisation doesn't fix it; every format failed at the same rate.

**Flat lookup mostly holds up once dataset size doesn't cause an outright failure.** At small and medium sizes, three of the four models score 96-100% regardless of format. The exception is Gemma-3-1B, which drops to 20% accuracy at the largest size among the requests it actually completed, a real degradation distinct from the memory failures discussed below.

**The format effect the taxonomy describes shows up only on nested lookups, and only for one of the four models.** Restricting to dataset sizes where every format had a fair, complete sample (excluding the largest size, where survivorship past the memory ceiling differs by format and model in ways that would bias the comparison):

| Model | CSV | JSON | XML | YAML | Plain text |
|---|---|---|---|---|---|
| Qwen2.5-1.5B | 14/18 | 11/18 | 7/18 | 11/18 | 6/18 |
| Qwen2.5-3B | 15/18 | 15/18 | 15/18 | 15/18 | 15/18 |
| Gemma-3-1B | 7/18 | 9/18 | 11/18 | 7/18 | 9/18 |
| Phi-4-mini | 9/18 | 12/18 | 12/18 | 15/18 | 12/18 |

Qwen2.5-1.5B shows a real CSV advantage on this task. Qwen2.5-3B, the same family one size up, shows no format effect at all: perfect, identical scores across every format. Gemma and Phi-4-mini each have their own best and worst formats, and neither agrees with Qwen's pattern or with each other. There is a format effect here, but it is small, inconsistent across models, and does not generalise into a rule like "use CSV for nested data." It looks like an artefact of how one particular model's tokenizer or attention handles one particular structure, not a property of the formats themselves.

**The fourth finding wasn't a question we set out to test.** At the largest dataset size, three of the four models failed 80% of requests with a CUDA out-of-memory error during prefill, before generating any answer; Gemma-3-1B failed 40% of the time under the same conditions. The failure is driven by the length of the rendered prompt, not by which model is loaded in any way related to parameter count: Phi-4-mini's attention computation requested roughly 2.5 times more memory than Qwen's or Gemma's for a comparably sized prompt, consistent with a different attention head configuration costing more per token of context, independent of the model's overall size. On a 6GB card, "the model fits" and "every prompt you send it will complete" are different claims, and the gap between them varies by model in ways that have nothing to do with how good that model is at the task.

## Conclusion

The taxonomy's central claim, that format choice routinely swings accuracy by 200-300%, didn't hold up as a general rule across the four models we tested. We saw it once, in one model, on one task type, and a same-family model one size up showed no format effect on the identical task at all. What we found instead was a task effect, consistent across every model: simple lookups work, nested lookups are inconsistent and model-specific, and aggregation fails completely past a handful of rows, for reasons that have nothing to do with serialisation.

That's the stronger argument for keeping lookups and sums out of the model's hands. Marigold's workflow engine does that arithmetic in Python rather than asking a model to retrieve and total values from serialised context, and this data is a direct measurement of the failure mode that design avoids: not a format problem you could fix by switching to a different one, but an operation these models don't reliably do at all once the dataset has any real size to it.
