export const styles = {
  action: 'dsh-sidecar-action',
  actions: 'dsh-sidecar-actions',
  assistant: 'dsh-sidecar-assistant',
  branches: 'dsh-sidecar-branches',
  branchEditor: 'dsh-sidecar-branch-editor',
  composer: 'dsh-sidecar-composer',
  contextNote: 'dsh-sidecar-context-note',
  count: 'dsh-sidecar-count',
  drawer: 'dsh-sidecar-drawer',
  empty: 'dsh-sidecar-empty',
  error: 'dsh-sidecar-error',
  excerpt: 'dsh-sidecar-excerpt',
  header: 'dsh-sidecar-header',
  markdown: 'dsh-sidecar-markdown',
  pending: 'dsh-sidecar-pending',
  role: 'dsh-sidecar-role',
  status: 'dsh-sidecar-status',
  surface: 'dsh-sidecar-surface',
  tool: 'dsh-sidecar-tool',
  transcript: 'dsh-sidecar-transcript',
  user: 'dsh-sidecar-user',
} as const

export const STYLE_TEXT = `
.dsh-sidecar-action{align-items:center;background:transparent;border:0;border-radius:.5rem;color:var(--dsw-alias-label-tertiary);cursor:pointer;display:inline-flex;font:inherit;gap:.3rem;min-height:1.75rem;padding:.25rem .45rem}
.dsh-sidecar-action:hover,.dsh-sidecar-action:focus-visible{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-sidecar-action:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.dsh-sidecar-action:disabled{cursor:progress;opacity:.48}
.dsh-sidecar-count{background:var(--dsw-alias-interactive-bg-hover);border-radius:999px;font-size:.72em;min-width:1.25rem;padding:.08rem .35rem;text-align:center}
.dsh-sidecar-drawer{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);background:var(--dsw-alias-bg-base);border-left:1px solid var(--dsw-alias-border-l2);bottom:0;box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:var(--dsw-font-family);position:fixed;right:0;top:0;width:clamp(360px,42vw,680px);z-index:80}
.dsh-sidecar-header{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;justify-content:space-between;min-height:3.5rem;padding:0 1rem}
.dsh-sidecar-header div{display:flex;flex-direction:column;gap:.1rem}.dsh-sidecar-header small{color:var(--dsw-alias-label-tertiary)}.dsh-sidecar-header button{background:transparent;border:0;border-radius:999px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:1.5rem}.dsh-sidecar-header button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-sidecar-branches{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;gap:.5rem;padding:.5rem 1rem}.dsh-sidecar-branches select,.dsh-sidecar-branch-editor input{background:var(--dsw-specific-input-major);border:1px solid var(--dsw-alias-border-l2);border-radius:.5rem;color:var(--dsw-alias-label-primary);flex:1;min-width:0;padding:.4rem .55rem}.dsh-sidecar-branches button{background:var(--dsw-alias-interactive-bg-hover);border:0;border-radius:.5rem;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:.45rem .65rem}.dsh-sidecar-branches button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}
.dsh-sidecar-branch-editor{align-items:center;display:flex;flex:1;gap:.5rem;min-width:0}.dsh-sidecar-branch-editor span{color:var(--dsw-alias-label-secondary);white-space:nowrap}
.dsh-sidecar-status{color:var(--dsw-alias-label-secondary);margin:auto;max-width:26rem;padding:1rem;text-align:center}
.dsh-sidecar-pending{align-items:center;background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary);display:flex;gap:.75rem;justify-content:space-between;padding:.65rem 1rem}.dsh-sidecar-pending p{margin:0}.dsh-sidecar-pending button{background:var(--dsw-specific-selector);border:0;border-radius:.55rem;color:var(--dsw-alias-label-primary);cursor:pointer;padding:.4rem .7rem;white-space:nowrap}
.dsh-sidecar-surface{display:flex;flex:1;flex-direction:column;min-height:0}
.dsh-sidecar-excerpt{background:var(--dsw-alias-interactive-bg-hover);border-left:3px solid var(--dsw-alias-state-business-primary);border-radius:.35rem;color:var(--dsw-alias-label-secondary);font-size:.82rem;line-height:1.5;margin:.75rem 1rem 0;max-height:7rem;overflow:auto;padding:.55rem .7rem;white-space:pre-wrap}
.dsh-sidecar-context-note,.dsh-sidecar-empty{color:var(--dsw-alias-label-tertiary);font-size:.78rem;line-height:1.45;margin:0;padding:.75rem 1rem}
.dsh-sidecar-transcript{display:flex;flex:1;flex-direction:column;gap:.75rem;min-height:0;overflow:auto;padding:.5rem 1rem 1rem}
.dsh-sidecar-transcript article{border-radius:.85rem;line-height:1.55;max-width:92%;min-width:0;padding:.7rem .85rem}.dsh-sidecar-transcript article>p{margin:.2rem 0 0;white-space:pre-wrap}
.dsh-sidecar-user{align-self:flex-end;background:var(--dsw-alias-state-business-tertiary)}.dsh-sidecar-assistant{align-self:stretch;background:transparent;max-width:none;padding:.35rem 0 .8rem}
.dsh-sidecar-markdown{color:var(--dsw-alias-label-primary);font-size:.94rem;line-height:1.72;min-width:0;overflow-wrap:anywhere}
.dsh-sidecar-markdown>:first-child,.dsh-sidecar-markdown>div>:first-child{margin-top:.25rem}.dsh-sidecar-markdown>:last-child,.dsh-sidecar-markdown>div>:last-child{margin-bottom:0}
.dsh-sidecar-markdown h1,.dsh-sidecar-markdown h2,.dsh-sidecar-markdown h3,.dsh-sidecar-markdown h4,.dsh-sidecar-markdown h5,.dsh-sidecar-markdown h6{color:var(--dsw-alias-label-primary);font-weight:700;line-height:1.35;margin:1.2em 0 .55em}.dsh-sidecar-markdown h1{font-size:1.38rem}.dsh-sidecar-markdown h2{font-size:1.22rem}.dsh-sidecar-markdown h3{font-size:1.08rem}.dsh-sidecar-markdown h4,.dsh-sidecar-markdown h5,.dsh-sidecar-markdown h6{font-size:1rem}
.dsh-sidecar-markdown p{margin:.58rem 0;white-space:normal}.dsh-sidecar-markdown ul,.dsh-sidecar-markdown ol{margin:.55rem 0;padding-left:1.45rem}.dsh-sidecar-markdown li{margin:.22rem 0}.dsh-sidecar-markdown li>p{margin:.2rem 0}
.dsh-sidecar-markdown code{background:var(--dsw-alias-interactive-bg-hover);border-radius:.32rem;font-family:var(--dsw-font-family-code,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:.88em;padding:.12em .34em}.dsh-sidecar-markdown pre{background:var(--dsw-specific-input-major);border:1px solid var(--dsw-alias-border-l2);border-radius:.65rem;line-height:1.55;margin:.75rem 0;max-width:100%;overflow:auto;padding:.75rem .85rem;white-space:pre}.dsh-sidecar-markdown pre code{background:transparent;border-radius:0;font-size:.84rem;padding:0;white-space:inherit}
.dsh-sidecar-markdown .md-code-block{background:var(--dsw-specific-input-major);border:1px solid var(--dsw-alias-border-l2);border-radius:.65rem;margin:.75rem 0;max-width:100%;overflow:hidden}.dsh-sidecar-markdown .md-code-block>div:first-child{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);display:flex;justify-content:space-between;min-height:2rem;padding:0 .65rem}.dsh-sidecar-markdown .md-code-block button{background:transparent;border:0;border-radius:.35rem;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;padding:.2rem .4rem}.dsh-sidecar-markdown .md-code-block button:hover,.dsh-sidecar-markdown .md-code-block button:focus-visible{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dsh-sidecar-markdown .md-code-block button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.dsh-sidecar-markdown .md-code-block pre{border:0;border-radius:0;margin:0}
.dsh-sidecar-markdown blockquote{border-left:3px solid var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-secondary);margin:.75rem 0;padding:.15rem 0 .15rem .8rem}.dsh-sidecar-markdown a{color:var(--dsw-alias-state-business-primary);text-decoration:underline;text-underline-offset:.16em}.dsh-sidecar-markdown a:focus-visible{border-radius:.2rem;outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.dsh-sidecar-markdown table{border-collapse:collapse;display:block;margin:.75rem 0;max-width:100%;overflow-x:auto;width:max-content}.dsh-sidecar-markdown th,.dsh-sidecar-markdown td{border:1px solid var(--dsw-alias-border-l2);padding:.42rem .58rem;text-align:left}.dsh-sidecar-markdown th{background:var(--dsw-alias-interactive-bg-hover);font-weight:650}.dsh-sidecar-markdown hr{border:0;border-top:1px solid var(--dsw-alias-border-l2);margin:1rem 0}.dsh-sidecar-markdown img{border-radius:.5rem;height:auto;max-width:100%}
.dsh-sidecar-tool{align-self:stretch;background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary);font-size:.86rem;max-width:none!important}.dsh-sidecar-role{color:var(--dsw-alias-label-tertiary);font-size:.7rem;font-weight:650}
.dsh-sidecar-error{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);margin:0;padding:.5rem 1rem}.dsh-sidecar-composer{border-top:1px solid var(--dsw-alias-border-l2);padding:.75rem}
.dsh-sidecar-composer textarea{background:var(--dsw-specific-input-major);border:1px solid var(--dsw-alias-border-l2);border-radius:.75rem;box-sizing:border-box;caret-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary);font:inherit;padding:.65rem .75rem;resize:vertical;width:100%}.dsh-sidecar-composer textarea::placeholder{color:var(--dsw-alias-label-caption)}
.dsh-sidecar-actions{display:flex;gap:.5rem;justify-content:flex-end;margin-top:.5rem}.dsh-sidecar-actions button{background:var(--dsw-specific-selector);border:0;border-radius:.55rem;color:var(--dsw-alias-label-primary);cursor:pointer;padding:.45rem .8rem}.dsh-sidecar-actions button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.dsh-sidecar-actions button:disabled{cursor:default;opacity:.45}
@media(max-width:760px){.dsh-sidecar-drawer{border-left:0;width:100vw}}
`
