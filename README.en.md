# MarkDo

English | [简体中文](README.md)

MarkDo is a magnetic always-on-top desktop To-do app for Windows, designed to keep task capture and task management as low-friction as possible.

This project was developed with assistance from [OpenAI Codex](https://developers.openai.com/codex/app), covering requirement breakdown, UI iteration, and the Electron/React implementation.

## Features

- Magnetic desktop edges: snap to screen edges and collapse into a slim edge tab when the mouse leaves.
- Always on top, suitable as a lightweight desktop task panel.
- Quick-add shortcut: opens a floating input window and adds the todo with Enter.
- Deadline support: todo background colors change based on urgency.
- Elapsed time is calculated in real time from the creation time.
- Todo titles are read-only by default; double-click a title to edit it.
- Swipe left to delete. Deleted todos are retained for 72 hours and can be restored.
- Drag todos up and down to reorder them.
- Each todo can open an independent detail window. Notes and details stay out of the main list.
- Screenshot OCR: select an area of the screen, recognize text, and create a todo. The original screenshot is stored in the detail view.
- Light, dark, and system theme modes.

## Shortcuts

Default shortcuts:

- Quick add: `Ctrl+Shift+Space`
- Screenshot OCR: `Ctrl+Shift+O`

Shortcuts can be recorded again in settings. The UI displays platform-specific shortcut labels, such as `Ctrl` on Windows and `⌘` / `⇧` on macOS.

## Development

```powershell
npm install
npm start
```

Development mode:

```powershell
npm run dev
```

## Local Packaging

```powershell
npm run dist
```

Build artifacts are written to `release/`:

- `MarkDo-0.1.0-x64-Setup.exe`
- `MarkDo-0.1.0-x64-Portable.zip`

## GitHub Actions Packaging

This repository includes a GitHub Actions workflow:

```text
.github/workflows/build.yml
```

Triggers:

- Manual `workflow_dispatch`
- Push to `main` or `master`
- Push a `v*` tag

The workflow runs on a Windows runner:

```powershell
npm ci
npm run dist
```

Regular builds upload artifacts. Pushing a `v*` tag also creates a GitHub Release with the installer and portable zip attached.

## OCR Engine

MarkDo uses the bundled RapidOCR-json engine first:

```text
vendor/ocr/RapidOCR-json/RapidOCR-json.exe
```

RapidOCR-json is an open-source project:

- [hiroi-sora/RapidOCR-json](https://github.com/hiroi-sora/RapidOCR-json)

If the local engine is missing in a development environment, run:

```powershell
npm run ocr:install
```

After packaging, the OCR engine is bundled as an app resource. Users do not need to install Python.

## Data

Todos, deleted todos, and settings are stored in Electron localStorage. The current version does not use a database.

## Acknowledgements

Thanks to [RapidOCR-json](https://github.com/hiroi-sora/RapidOCR-json) and the related open-source communities for providing offline OCR capability. MarkDo's screenshot OCR feature calls a local OCR engine through RapidOCR-json, and also benefits from the open-source work in the [RapidOCR](https://github.com/RapidAI/RapidOCR) / [RapidOcrOnnx](https://github.com/RapidAI/RapidOCR) ecosystem.
