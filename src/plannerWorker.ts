import { planScene, type Scene } from "./scene.ts";
import { suggestMove } from "./suggestMove.ts";

self.onmessage = ({ data: scene }: MessageEvent<Scene>) => {
  const solution = planScene(scene);
  self.postMessage({ solution });
  if (!solution.complete) {
    const stop = solution.path.at(-1) ?? scene.entrance;
    self.postMessage({ suggestion: suggestMove(scene, stop) });
  }
};
