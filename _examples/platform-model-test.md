---
layout: tutorial
title: "platform-model-test -- confirm a platform works"
description: "The smallest Marigold example: an application that sends one request to every catalogued model and exits 0 if all of them answer."
canonical: "https://marigold.run/examples/platform-model-test.html"
og_title: "platform-model-test -- Marigold example"
og_description: "A first run to confirm a Marigold platform serves every cached model."
category: Examples
---

The smallest example, and the one the
[setup guide](/tutorials/setup.html) runs. Its application lists the
catalogue through the API, submits one request to every catalogued
model, polls each to completion, prints a line per model, and exits 0
only if every model answered.

## Run

```bash
marigold package create marigold-examples/platform-model-test -o /tmp
marigold package install /tmp/platform-model-test-0.2.0.tar.gz
marigold cache populate platform-model-test
marigold application start platform-model-test
marigold application logs platform-model-test
```

## Models

- `qwen/qwen3-0.6b` -- instruct
- `huggingfacetb/smollm2-135m` -- instruct
- `sentence-transformers/all-minilm-l6-v2` -- text-embedding
- `openai/clip-vit-base-patch32` -- image-embedding
- `huggingfacetb/smolvlm-256m-instruct` -- img2txt

## Result

```bash
marigold application status platform-model-test
```

The exit code is 0 if every model answered. The catalogue is
host-wide, so the application tests every cached model, including
models cached for other packages. The first requests are slow while
each model loads.

## The application contract

`main.py` is the reference for writing an application. It reads
`MARIGOLD_API_BASE` and `MARIGOLD_APPLICATION_ID` from its environment,
sets `application_id` and a fresh `nonce` on every request, and polls
the `Location` each submission returns until the job completes.

## Stop

```bash
marigold application stop platform-model-test
```
