'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const editor = fs.readFileSync('editor/editor.js', 'utf8');
const html = fs.readFileSync('editor/index.html', 'utf8');
const wasmSource = fs.readFileSync('dwg-wasm/src/lib.rs', 'utf8');

assert.match(editor, /import\('\.\/vendor\/dwg\/otrocad_dwg\.js'\)/);
assert.doesNotMatch(editor, /cdn\.jsdelivr\.net\/npm\/@cadview\/dwg/);
assert.match(editor, /engine\.dwg_to_dxf\(/);
assert.match(editor, /engine\.dxf_to_dwg\(/);
assert.match(editor, /El motor no produjo un DWG binario AC1032 válido/);
assert.match(editor, /La validación DWG detectó diferencias de entidades/);
assert.match(html, /id="saveAsDwg"/);
assert.match(wasmSource, /DwgWriter::write_to_vec/);
assert.match(wasmSource, /DwgReader::from_stream/);
assert.match(wasmSource, /writes_real_ac1032_dwg_and_reads_it_back/);
console.log('DWG UI integration: local WASM, binary AC1032 writer, read-back validation and import are wired');
