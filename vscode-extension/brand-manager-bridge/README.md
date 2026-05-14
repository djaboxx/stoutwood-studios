# brand-manager-bridge

VS Code extension for the brand-manager workspace. Provides:

- **Language model tools** that Copilot agents call directly:
  - `brandManager_loadBrand` — read brand.json
  - `brandManager_loadVisualStyle` — read visual-style.json
  - `brandManager_runVoiceToContent` — run the voice → content pipeline
  - `brandManager_listOverdueLeads` — show leads with overdue follow-ups
  - `brandManager_gradeImageQuality` — score product photos and give style/composition capture guidance to improve engagement
- **Commands** (palette: `Brand Manager:`):
  - Record Voice Memo (stub — drop WAV in `audio/recordings/raw/` for now)
  - Run Voice → Content Pipeline (file picker → runs `voice_to_content.py`)
  - Grade Product Image Quality (multi-select photos for quality/style/composition review)
  - Open brand.json

## Build

```bash
cd vscode-extension/brand-manager-bridge
npm install
npm run build
```

Then F5 in VS Code to launch an Extension Development Host, or package with `vsce package`.

## Settings

- `brandManager.pythonPath` — Python interpreter for invoking scripts (defaults to `python3`).
