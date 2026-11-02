# Third-party notices

## acadrust 0.6.8
OtroCAD's local DWG/DXF WebAssembly bridge uses **acadrust 0.6.8**, Copyright the acadrust contributors, licensed under the Mozilla Public License 2.0 (MPL-2.0).

- Source: https://github.com/hakanaktt/acadrust
- License: https://github.com/hakanaktt/acadrust/blob/main/LICENSE
- The bridge wrapper in `dwg-wasm/` is OtroCAD project code. The acadrust dependency remains under its own MPL-2.0 terms.
- The acadrust source and any modifications to MPL-covered files must be made available in accordance with MPL-2.0 when distributed.

The compiled WebAssembly file in `editor/vendor/dwg/` is generated from this source dependency during CI; it is not a separately licensed proprietary converter.
