# Third-party notices

## acadrust 0.6.8
OtroCAD's local DWG/DXF WebAssembly bridge uses **acadrust 0.6.8**, Copyright the acadrust contributors, licensed under the Mozilla Public License 2.0 (MPL-2.0).

- Source: https://github.com/hakanaktt/acadrust
- License: https://github.com/hakanaktt/acadrust/blob/main/LICENSE
- The bridge wrapper in `dwg-wasm/` is OtroCAD project code. The acadrust dependency remains under its own MPL-2.0 terms.
- The acadrust source and any modifications to MPL-covered files must be made available in accordance with MPL-2.0 when distributed.

The compiled WebAssembly file in `editor/vendor/dwg/` is generated from this source dependency during CI; it is not a separately licensed proprietary converter.

## Proj4js 2.22.0

The geolocation module uses Proj4js 2.22.0 under the MIT license. Source: https://github.com/proj4js/proj4js . The unmodified browser distribution and complete license are in `editor/vendor/proj4/`.

## Online basemaps

Esri World Imagery, World Street Map and World Transportation are online reference layers; source attribution is shown on the map. World Imagery credits: Esri, Vantor, Earthstar Geographics, and the GIS User Community. The street map credits Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, OpenStreetMap contributors and the GIS User Community. Source metadata and terms:

- https://goto.arcgisonline.com/maps/World_Imagery
- https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer
- https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer

Only visible tiles are requested, using normal HTTP caching. Basemap images are not bundled with the app or exported as CAD entities.
