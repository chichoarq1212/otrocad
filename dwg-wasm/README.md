# OtroCAD DWG WebAssembly bridge

This small WebAssembly module converts the editor's ASCII DXF exchange output to a native binary DWG (AC1032 / AutoCAD 2018), and reads DWG back to DXF for import into the editor.

- Engine: `acadrust 0.6.8` (MPL-2.0), with default parallel features disabled for browser compatibility.
- No file is uploaded: conversion runs locally in the browser.
- Input limit: 100 MB.
- The editor first builds its supported DXF representation. Its existing DXF warning remains authoritative: unsupported or approximated source entities may be omitted or simplified before DWG writing.
- The generated DWG is reopened with the same engine before the UI reports success. This is a format/readability check, not a claim of AutoCAD certification.
- This module does not promise preservation of every proprietary object, proxy entity, dynamic block, external reference, or vertical-product extension.

Build:
```sh
rustup target add wasm32-unknown-unknown
cargo test --manifest-path dwg-wasm/Cargo.toml
cargo install wasm-pack
cd dwg-wasm
wasm-pack build --target web --release --out-dir ../editor/vendor/dwg --out-name otrocad_dwg
```
