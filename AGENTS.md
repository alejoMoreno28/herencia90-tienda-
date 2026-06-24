# Codex Rules For This Repository

These rules exist to prevent Codex Desktop from overloading the PC with large Git operations.

## Working Contract

- Inspect before editing. Read the relevant HTML, CSS, JS, scripts, docs, and generated data before making a change.
- Documentation-only tasks must not modify application code.
- Make small, safe, narrowly scoped changes. Preserve the current static HTML/CSS/JavaScript architecture unless Camilo explicitly asks for a larger migration.
- Do not add dependencies unless they are necessary and approved or clearly justified by the task.
- Do not modify secrets or copy values from `.env` into docs, code, commits, examples, or logs.
- If something is unclear, mark it as `Needs confirmation` instead of guessing.
- For HERENCIA90 customer-facing wording, preserve the brand convention `HERENCIA90` / `Herencia 90`, WhatsApp as support/sales channel, and prefer `bajo pedido` / `pre orden` where appropriate.
- For preorder/gallery/import work, audit first and import/upload later. Do not bulk upload, upsert, or replace Supabase assets until Camilo approves the reviewed output.

## Verification

- Run the smallest available checks that match the change.
- There is currently no declared `npm run build`, `npm run lint`, or `npm test` script. Prefer direct checks such as `node --test <test files>`, `node tests\site-seo.test.mjs`, or `node --check <script>` when relevant.
- For docs-only changes, proofread the changed Markdown and confirm no app files changed.
- Summarize files changed and commands run in the final response.

## Git Safety

- Never run or trigger a broad staging command such as `git add --`, `git add .`, `git add -A`, or any "stage all changes" action in this repository.
- Stage only the exact small files needed for the current task, for example `git add -- web/index.html`.
- Do not stage raw videos, exported videos, generated image folders, cache folders, `.codex-scratch`, `.codex_tmp`, or local working media.
- Before any Git staging, check whether the file is intentionally part of the website/app source. If it is a reference video, raw footage, generated output, temporary cache, or supplier asset batch, leave it untracked.
- If Git starts spawning many `git.exe` / "Git for Windows" processes or CPU rises sharply, stop Git processes first and inspect the pending command before continuing.

## Heavy Local Folders

The following paths are local working material and must stay out of Git:

- `VIDEOS REFERENCIA EDICION/`
- `.codex-scratch/`
- `.codex-temp/`
- `.codex_tmp/`
- `.pedido-imagenes-cache/`
- `EQUIPOS_CENSURADOS/`
- `EQUIPOS_CON_FONDO/`
- video files such as `.mp4`, `.mov`, `.m4v`, `.avi`, `.webm`

If the user explicitly wants to publish or version a media asset, ask first and use a narrowly scoped path.
