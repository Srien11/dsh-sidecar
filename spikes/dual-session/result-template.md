# Dual-Session spike result

## Runtime

- Date:
- Harness version:
- Build/revision:
- Node.js:
- Browser:
- `DSH_HOME`:
- API key available: yes/no (never record the key)

## Results

| Check | Pass | Evidence |
|---|---:|---|
| Fork without current selection change |  |  |
| Prompt non-current child |  |  |
| Observe two Session streams |  |  |
| Render native child surface |  |  |
| Cancel and reconnect child |  |  |
| Dispose all child resources |  |  |
| Enforce per-child read-only policy |  |  |

## Route decision

- [ ] Route A: native dual Session surface
- [ ] Route B: same-origin embedded page
- [ ] Route C: frozen parent snapshot
- [ ] No-Go for the required interaction

## Decision rationale

Record only observed public behavior and link every conclusion to a command, runtime query, test, or screenshot.
