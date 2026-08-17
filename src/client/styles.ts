export const styles = {
  action: 'dsh-sidecar-action',
  actions: 'dsh-sidecar-actions',
  assistant: 'dsh-sidecar-assistant',
  composer: 'dsh-sidecar-composer',
  contextNote: 'dsh-sidecar-context-note',
  count: 'dsh-sidecar-count',
  drawer: 'dsh-sidecar-drawer',
  empty: 'dsh-sidecar-empty',
  error: 'dsh-sidecar-error',
  excerpt: 'dsh-sidecar-excerpt',
  header: 'dsh-sidecar-header',
  pending: 'dsh-sidecar-pending',
  role: 'dsh-sidecar-role',
  status: 'dsh-sidecar-status',
  surface: 'dsh-sidecar-surface',
  tool: 'dsh-sidecar-tool',
  transcript: 'dsh-sidecar-transcript',
  user: 'dsh-sidecar-user',
} as const

export const STYLE_TEXT = `
.dsh-sidecar-action{align-items:center;background:transparent;border:0;border-radius:.5rem;color:inherit;cursor:pointer;display:inline-flex;font:inherit;gap:.3rem;min-height:1.75rem;opacity:.72;padding:.25rem .45rem}
.dsh-sidecar-action:hover,.dsh-sidecar-action:focus-visible{background:color-mix(in srgb,currentColor 9%,transparent);opacity:1}
.dsh-sidecar-action:disabled{cursor:progress;opacity:.48}
.dsh-sidecar-count{background:color-mix(in srgb,currentColor 12%,transparent);border-radius:999px;font-size:.72em;min-width:1.25rem;padding:.08rem .35rem;text-align:center}
.dsh-sidecar-drawer{background:Canvas;border-left:1px solid color-mix(in srgb,currentColor 12%,transparent);bottom:0;box-shadow:-16px 0 42px rgb(0 0 0 / 12%);color:CanvasText;display:flex;flex-direction:column;position:fixed;right:0;top:0;width:clamp(360px,42vw,680px);z-index:80}
.dsh-sidecar-header{align-items:center;border-bottom:1px solid color-mix(in srgb,currentColor 12%,transparent);display:flex;justify-content:space-between;min-height:3.5rem;padding:0 1rem}
.dsh-sidecar-header div{display:flex;flex-direction:column;gap:.1rem}.dsh-sidecar-header small{opacity:.58}.dsh-sidecar-header button{background:transparent;border:0;color:inherit;cursor:pointer;font-size:1.5rem}
.dsh-sidecar-status{margin:auto;max-width:26rem;padding:1rem;text-align:center}
.dsh-sidecar-pending{align-items:center;background:color-mix(in srgb,#d97706 10%,transparent);display:flex;gap:.75rem;justify-content:space-between;padding:.65rem 1rem}.dsh-sidecar-pending p{margin:0}.dsh-sidecar-pending button{border:0;border-radius:.55rem;cursor:pointer;padding:.4rem .7rem;white-space:nowrap}
.dsh-sidecar-surface{display:flex;flex:1;flex-direction:column;min-height:0}
.dsh-sidecar-excerpt{background:color-mix(in srgb,currentColor 6%,transparent);border-left:3px solid currentColor;border-radius:.35rem;color:color-mix(in srgb,currentColor 72%,transparent);font-size:.82rem;line-height:1.5;margin:.75rem 1rem 0;max-height:7rem;overflow:auto;padding:.55rem .7rem;white-space:pre-wrap}
.dsh-sidecar-context-note,.dsh-sidecar-empty{color:color-mix(in srgb,currentColor 62%,transparent);font-size:.78rem;line-height:1.45;margin:0;padding:.75rem 1rem}
.dsh-sidecar-transcript{display:flex;flex:1;flex-direction:column;gap:.75rem;min-height:0;overflow:auto;padding:.5rem 1rem 1rem}
.dsh-sidecar-transcript article{border-radius:.85rem;line-height:1.55;max-width:92%;padding:.7rem .85rem}.dsh-sidecar-transcript article p{margin:.2rem 0 0;white-space:pre-wrap}
.dsh-sidecar-user{align-self:flex-end;background:color-mix(in srgb,#4f7cff 16%,transparent)}.dsh-sidecar-assistant{align-self:flex-start;background:color-mix(in srgb,currentColor 7%,transparent)}
.dsh-sidecar-tool,.dsh-sidecar-error{align-self:stretch;background:color-mix(in srgb,#d97706 10%,transparent);font-size:.86rem;max-width:none!important}.dsh-sidecar-role{font-size:.7rem;font-weight:650;opacity:.58}
.dsh-sidecar-error{color:#b42318;margin:0;padding:.5rem 1rem}.dsh-sidecar-composer{border-top:1px solid color-mix(in srgb,currentColor 12%,transparent);padding:.75rem}
.dsh-sidecar-composer textarea{background:color-mix(in srgb,currentColor 4%,transparent);border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:.75rem;box-sizing:border-box;color:inherit;font:inherit;resize:vertical;width:100%}
.dsh-sidecar-actions{display:flex;gap:.5rem;justify-content:flex-end;margin-top:.5rem}.dsh-sidecar-actions button{border:0;border-radius:.55rem;cursor:pointer;padding:.45rem .8rem}
@media(max-width:760px){.dsh-sidecar-drawer{border-left:0;width:100vw}}
`
