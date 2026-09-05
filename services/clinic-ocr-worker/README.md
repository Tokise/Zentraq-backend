# Private consultation OCR worker

This optional pull worker processes private consultation scans. Keep the clinic
forms feature disabled until the clinical team approves templates and validates
representative handwritten, rotated, unclear and multi-page samples.

Use an isolated Python environment and install the pinned `requirements.txt`.
Preload clinic-reviewed PP-OCRv5 detection and recognition models into directories
outside the repository. Configure these environment variables through the host's
secret manager (never in a browser or committed file):

- `SUPABASE_URL`: the clinic project HTTPS endpoint.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key, restricted to this worker host.
- `OCR_DETECTION_MODEL_DIR`: local preloaded detection model directory.
- `OCR_RECOGNITION_MODEL_DIR`: local preloaded recognition model directory.

Run `python worker.py` from this directory under a supervised, unprivileged process.
Allow outbound TLS to the clinic Supabase project; no inbound port is needed.
Block external model download/telemetry endpoints at the host firewall. CPU inference
uses the supplied models; orientation classifiers and image unwarping are disabled.
Pinning packages does not establish handwriting accuracy or runtime compatibility:
the full Paddle runtime/model combination still needs installation and sample testing.

Jobs use five-minute leases and bounded retries. Originals stay in the private
`consultation-scans` bucket. Rendering is memory-only, limited to five pages,
10 MB and 20 million pixels per page. Set process memory/CPU limits and disable
core dumps. Apply the clinic retention policy to originals and backups. Logs contain
generic outcomes only; do not add extracted text, patient identifiers or signed URLs.

Staff must confirm identity and review fields before import. Unreadable or mismatched
forms require manual handling. OCR never authorizes signatures, orders medication,
completes consultations or issues clearances. Disable forms to stop new issuance
and worker claims; existing records remain available to authorized staff.

Run mapping tests with `python -m unittest test_extraction.py`. They verify field
mapping, signature exclusion and QR handling, not actual handwriting recognition.
The SQL workflow suite runs from the backend root with
`node scripts/test-flexible-clinic.mjs` after `pnpm install`; it uses a pinned,
development-only in-memory PGlite database and never connects to production.
