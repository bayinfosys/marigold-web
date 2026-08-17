---
layout: tutorial
title: "platform-test -- confirm a fresh deployment works"
description: "The smallest Marigold example: exercises the core API endpoints against small models, for a fast first run."
canonical: "https://marigold.run/examples/platform-test.html"
og_title: "platform-test -- Marigold example"
og_description: "A fast first run to confirm a Marigold deployment is working correctly."
category: Examples
---

Smallest example. Exercises the core API endpoints against small
models -- a fast first run to confirm everything's working.

## Run

```bash
marigold deployment start marigold-examples/platform-test
```

## Models

- `qwen/qwen3-0.6b` -- instruct
- `huggingfacetb/smollm2-135m` -- instruct
- `sentence-transformers/all-minilm-l6-v2` -- text-embedding
- `openai/clip-vit-base-patch32` -- image-embedding
- `huggingfacetb/smolvlm-256m-instruct` -- img2txt

## Test it

```bash
python run.py
```

Exercises `/models`, `/embed/text`, `/embed/image`, `/gen/instruct`,
`/gen/img2txt` against the deployment above.

## Stop

```bash
marigold deployment stop marigold-examples/platform-test
```
