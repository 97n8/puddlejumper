import assert from "node:assert/strict";
import test from "node:test";
import { Ball } from "../src/ball.js";

test("Ball starts at origin by default", () => {
  const ball = new Ball();
  assert.deepStrictEqual(ball.position(), { x: 0, y: 0, z: 0 });
});

test("Ball accepts a custom initial position", () => {
  const ball = new Ball({ x: 1, y: 2, z: 3 });
  assert.deepStrictEqual(ball.position(), { x: 1, y: 2, z: 3 });
});

test("Ball.move applies deltas correctly", () => {
  const ball = new Ball();
  ball.move({ x: 5 });
  assert.deepStrictEqual(ball.position(), { x: 5, y: 0, z: 0 });
});

test("Agent 3: move ball +2 on Z axis", () => {
  const ball = new Ball();
  const after = ball.move({ z: 2 });
  assert.deepStrictEqual(after, { x: 0, y: 0, z: 2 });
});

test("Multiple moves accumulate", () => {
  const ball = new Ball();
  ball.move({ x: 1, y: 1, z: 1 });
  ball.move({ z: 2 }); // Agent 3's +2 Z
  assert.deepStrictEqual(ball.position(), { x: 1, y: 1, z: 3 });
});
