---
layout: tutorial
title: "benchmark-llm -- power and latency benchmarking across models"
description: "An application that submits a fixed prompt set to every instruct model in the Marigold catalogue and records timing, tokens, VRAM and power draw per response."
canonical: "https://marigold.run/examples/benchmark-llm.html"
og_title: "benchmark-llm -- Marigold example"
og_description: "Benchmark harness used to build the analysis in AI-Wales/build-llm-power-sampling."
category: Examples
---

An application that submits a fixed prompt set to every instruct model
in the catalogue and records timing, token counts, VRAM and power draw
per response. Safe to re-run: each request's ID is a hash of its
contents, so resubmitting completed work is a cache-status check.

Used to build the analysis in
[AI-Wales/build-llm-power-sampling](https://github.com/AI-Wales/build-llm-power-sampling).
This assumes the [setup guide](/tutorials/setup.html) is done.

## Models

Declare the instruct models to benchmark in the package's
`models.yaml`. The application benchmarks every instruct model in the
catalogue, which is host-wide, so models cached for other packages are
included.

## Run

```bash
marigold package create marigold-examples/benchmark-llm -o /tmp
marigold package install /tmp/benchmark-llm-<version>.tar.gz
marigold cache populate benchmark-llm
marigold application start benchmark-llm
marigold application logs benchmark-llm
```

The application reaches the API at `MARIGOLD_API_BASE`, tags every
request with `application_id` from `MARIGOLD_APPLICATION_ID`, and
writes one CSV per run to `/outputs`. On the host, that is
`data/applications/benchmark-llm/outputs` under the cache directory.
`marigold application status benchmark-llm` shows the exit code when
the run finishes.

Starting the application again picks up anything that finished since
the last run. Each run writes a new CSV; nothing is skipped by tracking
state.

## Options

Options form the application's command, set in `marigold.toml`:

```toml
[execution]
command = ["python", "run_benchmark.py", "--max-prompts", "40", "--workers", "8"]
```

- `--max-prompts N` -- a stratified sample of N prompts spread across
  prompt groups, for a quick smoke test.
- `--workers N` -- concurrent requests (default 16).
- `--temperature` -- default 1.0.
- `--out path` -- the results file (default: a timestamped CSV in
  `/outputs`).

To try options without rebuilding the package, start the application
from its directory. A directory is mounted where it lies, so an edit to
`marigold.toml` or the code takes effect on the next start:

```bash
marigold application start marigold-examples/benchmark-llm
```

## From the host

The script also runs as an external client against the API's published
port, with `requests` installed:

```bash
python run_benchmark.py --base-url http://localhost:8000 --out results/run1.csv
```

## Regenerating the prompt set

`prompts.jsonl` is already built and committed. Only needed if you're
changing the prompt set itself:

```bash
python build_prompts.py
```

Three prompt groups: `varying_context` (system prompt length, short
through long), `structured` (JSON-schema-constrained output),
`long_form` (long generations, for sustained power/VRAM sampling).
Edit the topic and template lists in `build_prompts.py` to grow the
set -- prompts are generated combinatorially. Rebuild and install the
package after regenerating.
