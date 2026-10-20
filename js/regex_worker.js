// Runs regex tests off the main thread: a pattern with runaway backtracking can freeze a tab,
// so the editor gives the worker a time limit and stops it if it takes too long.
import { runPipeline } from './regex_model.js';

self.onmessage = e => {
  const { id, scripts, text, opts } = e.data || {};
  try { self.postMessage({ id, ok: true, result: runPipeline(scripts, text, opts) }); }
  catch (err) { self.postMessage({ id, ok: false, error: String(err && err.message || err) }); }
};
