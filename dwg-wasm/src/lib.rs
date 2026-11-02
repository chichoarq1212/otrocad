use std::io::Cursor;
use wasm_bindgen::prelude::*;
use acadrust::{DwgReader, DwgWriter, DxfReader, DxfWriter, DxfVersion};

const MAX_INPUT_BYTES: usize = 100 * 1024 * 1024;

fn convert_dxf_to_dwg(input: &[u8]) -> Result<Vec<u8>, String> {
    if input.is_empty() { return Err("El DXF está vacío".into()); }
    if input.len() > MAX_INPUT_BYTES { return Err("El DXF supera el límite de 100 MB".into()); }
    let cursor = Cursor::new(input.to_vec());
    let mut document = DxfReader::from_reader(cursor)
        .and_then(|reader| reader.read())
        .map_err(|error| format!("No se pudo leer el DXF: {error}"))?;
    // AC1032 is AutoCAD 2018 DWG. The source DXF is parsed as a real CAD database.
    document.version = DxfVersion::AC1032;
    let output = DwgWriter::write_to_vec(&document)
        .map_err(|error| format!("No se pudo escribir DWG: {error}"))?;
    if output.len() < 6 || !output.starts_with(b"AC1032") {
        return Err("El escritor no produjo una cabecera DWG AC1032 válida".into());
    }
    Ok(output)
}

fn convert_dwg_to_dxf(input: &[u8]) -> Result<Vec<u8>, String> {
    if input.len() < 6 { return Err("El archivo DWG es demasiado pequeño".into()); }
    if input.len() > MAX_INPUT_BYTES { return Err("El DWG supera el límite de 100 MB".into()); }
    let document = DwgReader::from_stream(Cursor::new(input.to_vec()))
        .read()
        .map_err(|error| format!("No se pudo leer el DWG: {error}"))?;
    DxfWriter::new(&document)
        .write_to_vec()
        .map_err(|error| format!("No se pudo convertir DWG a DXF: {error}"))
}

#[wasm_bindgen]
pub fn dxf_to_dwg(input: &[u8]) -> Result<Vec<u8>, JsValue> {
    convert_dxf_to_dwg(input).map_err(|message| JsValue::from_str(&message))
}

#[wasm_bindgen]
pub fn dwg_to_dxf(input: &[u8]) -> Result<Vec<u8>, JsValue> {
    convert_dwg_to_dxf(input).map_err(|message| JsValue::from_str(&message))
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &[u8] = b"0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1021\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nMuros\n10\n0\n20\n0\n11\n4000\n21\n0\n0\nCIRCLE\n8\nDetalles\n10\n1000\n20\n1000\n40\n250\n0\nTEXT\n8\nTextos\n10\n100\n20\n200\n40\n150\n1\nSALA\n0\nENDSEC\n0\nEOF\n";

    #[test]
    fn writes_real_ac1032_dwg_and_reads_it_back() {
        let dwg = convert_dxf_to_dwg(FIXTURE).expect("DXF -> DWG");
        assert!(dwg.starts_with(b"AC1032"));
        let dxf = convert_dwg_to_dxf(&dwg).expect("DWG -> DXF");
        let document = DxfReader::from_reader(Cursor::new(dxf))
            .and_then(|reader| reader.read())
            .expect("read round-trip DXF");
        assert_eq!(document.entities().count(), 3);
    }

    #[test]
    fn rejects_empty_and_oversized_inputs() {
        assert!(convert_dxf_to_dwg(&[]).is_err());
        assert!(convert_dwg_to_dxf(&[]).is_err());
        assert!(convert_dxf_to_dwg(&vec![0; MAX_INPUT_BYTES + 1]).is_err());
    }
}
