# Codex Rules For This Repository

These rules exist to prevent Codex Desktop from overloading the PC with large Git operations.

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
