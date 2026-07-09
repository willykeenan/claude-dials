# claude-dials — Behavioral-Obedience Eval

**Mode:** mock (hermetic)  |  **Dial swing:** 1 → 9  |  **Pass:** 6/6  |  **Mean effect:** 14.39

> Each row prepends the real rendered dials block with one dial at low vs high, then measures a deterministic signal that should track that dial. Positive normalized Δ = the model moved in the direction the dial promises.

| task | dial | metric | low | high | Δ | normalized | pass |
|---|---|---|---:|---:|---:|---:|:--:|
| verbosity_explain | verbosity | verbosity | 10 | 105 | 95 | 9.50 | ✅ |
| verbosity_decision | verbosity | verbosity | 10 | 97 | 87 | 8.70 | ✅ |
| rigor_algo | rigor | rigor | 7 | 165 | 158 | 22.57 | ✅ |
| rigor_review | rigor | rigor | 7 | 227 | 220 | 31.43 | ✅ |
| verification_fix | verification | verification | 0 | 7 | 7 | 7.00 | ✅ |
| verbosity_debug | verbosity | verbosity | 6 | 49 | 43 | 7.17 | ✅ |
