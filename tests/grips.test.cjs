const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('editor/editor.js', 'utf8');
const descriptorsStart = source.indexOf('function dimensionGeometry(s){');
const descriptorsEnd = source.indexOf('function drawSelectionGrips()', descriptorsStart);
const applyStart = source.indexOf('function applyGrip(s,key,q){');
const applyEnd = source.indexOf('function cancelGripDrag()', applyStart);
assert.ok(descriptorsStart >= 0 && descriptorsEnd > descriptorsStart, 'gripDescriptors function must exist');
assert.ok(applyStart >= 0 && applyEnd > applyStart, 'applyGrip function must exist');

const geometry = source.slice(descriptorsStart, descriptorsEnd) + '\n' + source.slice(applyStart, applyEnd);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const { gripDescriptors, applyGrip } = new Function('distance', geometry + '\nreturn { gripDescriptors, applyGrip };')(distance);

const colorStart = source.indexOf('function resolveCadColor(');
const colorEnd = source.indexOf('function canvasIsLight()', colorStart);
assert.ok(colorStart >= 0 && colorEnd > colorStart, 'resolveCadColor function must exist');
const colorCode = source.slice(colorStart, colorEnd);
const colors = { General: '#dce8f5', Muros: '#56b7e8', Cotas: '#f3c83e' };
const resolveCadColor = new Function('colors', colorCode + '\nreturn resolveCadColor;')(colors);

const results = [];
function test(name, fn) {
  fn();
  results.push(name);
}

test('automatic CAD color contrasts with dark and light canvases', () => {
  assert.equal(resolveCadColor({ layer: 'General', color: '#dce8f5' }, false), '#ffffff');
  assert.equal(resolveCadColor({ layer: 'General', color: '#dce8f5' }, true), '#111111');
  assert.equal(resolveCadColor({ layer: 'Muros', color: '#56b7e8' }, false), '#56b7e8');
  assert.equal(resolveCadColor({ layer: 'Cotas', color: '#f3c83e' }, true), '#f3c83e');
});

test('line endpoints', () => {
  const e = { type: 'line', a: { x: 0, y: 0 }, b: { x: 5, y: 0 } };
  assert.equal(gripDescriptors(e).length, 2);
  applyGrip(e, 'a', { x: 1, y: 2 });
  assert.deepEqual(e.a, { x: 1, y: 2 });
});

test('dimension and leader endpoints', () => {
  for (const type of ['dim', 'leader']) {
    const e = { type, a: { x: 0, y: 0 }, b: { x: 4, y: 3 } };
    assert.equal(gripDescriptors(e).length, type === 'dim' ? 3 : 2);
    applyGrip(e, 'b', { x: 8, y: 6 });
    assert.deepEqual(e.b, { x: 8, y: 6 });
  }
});

test('dimension offset moves only the dimension line for horizontal and angled walls', () => {
  const e = {type:'dimaligned', a:{x:0,y:0}, b:{x:4,y:0}};
  applyGrip(e,'dimOffset',{x:8,y:2});
  assert.equal(e.dimOffset,2);
  assert.deepEqual(e.a,{x:0,y:0});assert.deepEqual(e.b,{x:4,y:0});
  assert.deepEqual(gripDescriptors(e).find(g=>g.key==='dimOffset').p,{x:2,y:2});
  const angled={type:'dim',a:{x:0,y:0},b:{x:3,y:4}};
  applyGrip(angled,'dimOffset',{x:-1.6,y:1.2});
  assert.ok(Math.abs(angled.dimOffset-2)<1e-9);
});

test('polyline and polygon vertices', () => {
  for (const type of ['poly', 'polygon']) {
    const e = { type, pts: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }] };
    assert.equal(gripDescriptors(e).length, 3);
    applyGrip(e, 'pt:1', { x: 8, y: 2 });
    assert.deepEqual(e.pts[1], { x: 8, y: 2 });
  }
});

test('rectangle and hatch corners', () => {
  for (const type of ['rect', 'hatch']) {
    const e = { type, a: { x: 0, y: 0 }, b: { x: 4, y: 3 } };
    assert.equal(gripDescriptors(e).length, 4);
    applyGrip(e, 'rect2', { x: 7, y: 6 });
    assert.deepEqual(e.a, { x: 0, y: 0 });
    assert.deepEqual(e.b, { x: 7, y: 6 });
  }
});

test('circle center and radius grips', () => {
  const e = { type: 'circle', a: { x: 0, y: 0 }, b: { x: 3, y: 0 } };
  assert.equal(gripDescriptors(e).length, 5);
  applyGrip(e, 'radius', { x: 0, y: 5 });
  assert.deepEqual(e.b, { x: 0, y: 5 });
});

test('ellipse center and axis grips', () => {
  const e = { type: 'ellipse', a: { x: 0, y: 0 }, b: { x: 4, y: 2 } };
  assert.equal(gripDescriptors(e).length, 5);
  applyGrip(e, 'rx-', { x: -7, y: 0 });
  applyGrip(e, 'ry+', { x: 0, y: 6 });
  assert.deepEqual(e.b, { x: -7, y: 6 });
});

test('arc control points', () => {
  const e = { type: 'arc', pts: [{ x: 0, y: 0 }, { x: 2, y: 4 }, { x: 5, y: 0 }] };
  assert.equal(gripDescriptors(e).length, 3);
  applyGrip(e, 'pt:1', { x: 3, y: 6 });
  assert.deepEqual(e.pts[1], { x: 3, y: 6 });
});

test('text insertion point', () => {
  const e = { type: 'text', a: { x: 1, y: 1 } };
  assert.equal(gripDescriptors(e).length, 1);
  applyGrip(e, 'a', { x: 2, y: 3 });
  assert.deepEqual(e.a, { x: 2, y: 3 });
});

console.log('CAD grip tests passed: ' + results.join(', '));
