# Colony Lab — RimWorld Web Port Research

This repository is a browser prototype and research workspace exploring the technical path toward a web-playable colony simulation.

**Important:** the current site is an original, small interface/gameplay prototype. It is **not** the original RimWorld game, does not contain RimWorld's proprietary source code or assets, and is not yet a working port of the PC game.

## Run locally

Open `index.html` in a modern browser. The prototype uses plain HTML, CSS and JavaScript; no build step is required. An internet connection may be used by the page to load optional Google Fonts, but gameplay itself is local.

## Current prototype features

- Responsive browser interface
- Selectable 9 × 7 colony grid
- Place simple paths, gardens, beds and walls
- Resource counters and end-of-day simulation
- Event log

## What is needed for a real web port

A Windows Unity game folder is not automatically browser-compatible. A real port would require one of the following, with the necessary rights and technical access:

1. An authorized Unity WebGL build from a compatible Unity project; or
2. Access to source code and a deliberate port/reimplementation of platform-specific functionality for the browser.

The supplied Windows data files are not sufficient by themselves to prove a WebGL build exists. The large proprietary game files should not be committed to this public repository. Keep licensed local game files local and only publish material you have permission to redistribute.

## Planned research stages

1. Identify the available project inputs and their licensing/redistribution status.
2. Determine whether an authorized source project or WebGL build is available.
3. Prototype input, save/load, asset loading and performance constraints independently.
4. Only then integrate an authorized compatible game build, if feasible.

## Hosting

This is a static site. GitHub Pages can serve the prototype files from the repository root; Pages hosting does not make a Windows executable run in the browser.
