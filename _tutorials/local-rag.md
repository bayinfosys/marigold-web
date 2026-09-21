## Start it

The `simple-rag` package has this wired up: a chat model and an
embedding model in its `models.yaml`, `webui` in its `compose_files`,
and Open WebUI's `RAG_EMBEDDING_MODEL` pointed at the same embedding
model through its `[environment]` table:

```bash
marigold package create marigold-examples/simple-rag -o /tmp
marigold package install /tmp/simple-rag-<version>.tar.gz
marigold cache populate simple-rag
marigold application start simple-rag
```

`package create` prints the archive path. `cache populate` downloads
both models. `application start` adds Open WebUI to the platform, on
the applications network as a client of the API, then runs the
package's application, which checks that both models are in the
catalogue. `marigold application status simple-rag` shows exit code 0
when they are.

Open WebUI keeps its documents, vector store and chat history under the
cache directory, in `data/webui`. It runs with the platform:
`marigold application stop simple-rag` leaves it running, and
`marigold platform stop` stops it.

Once it's up, `http://localhost:3000`'s embedding settings
(Admin Panel -> Settings -> Documents) should already show the right
model -- worth a glance, since if this is wrong, uploads still appear
to succeed and chat still looks normal; the failure is silent rather
than an error you'd notice.
