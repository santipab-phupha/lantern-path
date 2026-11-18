import assert from 'node:assert/strict';
import { test } from 'node:test';
import { midnightManor } from '../src/estate.ts';
import { planScene, EXAMPLE_BOOK_FAIR, EXAMPLE_NARROW_CORNER } from '../src/scene.ts';
import { suggestMove } from '../src/suggestMove.ts';

for (const [name, scene] of [['book fair', EXAMPLE_BOOK_FAIR], ['midnight manor', midnightManor]]) {
  test(name + ' suggestion opens the route without editing the original', () => {
    const original = structuredClone(scene);
    const blocked = planScene(scene);
    assert.equal(blocked.complete, false);
    const advice = suggestMove(scene, blocked.path.at(-1));
    assert.ok(advice);
    assert.notEqual(advice.object.kind, 'wall');
    const edited = scene.obstacles.map(o => o.id === advice.object.id ? advice.object : o);
    assert.equal(planScene({ ...scene, obstacles: edited }).complete, true);
    assert.deepEqual(scene, original);
  });
}

test('a structural corner has no furniture move', () => {
  const blocked = planScene(EXAMPLE_NARROW_CORNER);
  assert.equal(suggestMove(EXAMPLE_NARROW_CORNER, blocked.path.at(-1)), null);
});
