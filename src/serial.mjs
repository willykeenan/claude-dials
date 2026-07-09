// Serializes async store operations so concurrent set_dial/apply_preset calls
// cannot interleave load → mutate → save and lose updates. Hosted serverless
// still has multi-instance races (two warm isolates); this fixes same-isolate
// batching and any transport that reuses one store for parallel messages.

export function createSerialStore(inner) {
  let chain = Promise.resolve();

  function enqueue(fn) {
    // Always advance the chain even if fn rejects, so one failure doesn't
    // permanently stall subsequent ops.
    const run = chain.then(fn, fn);
    chain = run.then(
      () => {},
      () => {}
    );
    return run;
  }

  return {
    load() {
      return enqueue(() => inner.load());
    },
    save(state, stamp) {
      return enqueue(() => inner.save(state, stamp));
    },
    // Atomic read-modify-write. Prefer this for mutations.
    update(mutator, stamp) {
      return enqueue(async () => {
        const state = await inner.load();
        const next = await mutator(state);
        return inner.save(next, stamp);
      });
    },
  };
}
