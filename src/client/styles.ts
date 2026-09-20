export const styles = {
  action: 'dsh-sidecar-action',
  actions: 'dsh-sidecar-actions',
  assistant: 'dsh-sidecar-assistant',
  branches: 'dsh-sidecar-branches',
  branchRestore: 'dsh-sidecar-branch-restore',
  branchRestoreActive: 'dsh-sidecar-branch-restore-active',
  branchEditor: 'dsh-sidecar-branch-editor',
  close: 'dsh-sidecar-close',
  composer: 'dsh-sidecar-composer',
  contextNote: 'dsh-sidecar-context-note',
  drawer: 'dsh-sidecar-drawer',
  empty: 'dsh-sidecar-empty',
  error: 'dsh-sidecar-error',
  excerpt: 'dsh-sidecar-excerpt',
  header: 'dsh-sidecar-header',
  highlight: 'dsh-sidecar-highlight',
  markdown: 'dsh-sidecar-markdown',
  pending: 'dsh-sidecar-pending',
  role: 'dsh-sidecar-role',
  responding: 'dsh-sidecar-responding',
  respondingDot: 'dsh-sidecar-responding-dot',
  selectionAction: 'dsh-sidecar-selection-action',
  status: 'dsh-sidecar-status',
  streamingAction: 'dsh-sidecar-streaming-action',
  surface: 'dsh-sidecar-surface',
  tool: 'dsh-sidecar-tool',
  transcript: 'dsh-sidecar-transcript',
  user: 'dsh-sidecar-user',
  windowHandle: 'dsh-sidecar-window-handle',
  windowReset: 'dsh-sidecar-window-reset',
  windowResize: 'dsh-sidecar-window-resize',
  windowResizeEdge: (edge: string) => `dsh-sidecar-window-resize-${edge}`,
} as const

export const STYLE_TEXT = `
.dsh-sidecar-action{align-items:center;background:transparent;border:0;border-radius:.5rem;color:var(--dsw-alias-label-tertiary);cursor:pointer;display:inline-flex;font:inherit;gap:.3rem;min-height:1.75rem;padding:.25rem .45rem}
.dsh-sidecar-action:hover,.dsh-sidecar-action:focus-visible{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-sidecar-action:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.dsh-sidecar-action:disabled{cursor:progress;opacity:.48}
.dsh-sidecar-streaming-action{font-size:.78rem;min-height:1.6rem;white-space:nowrap}
.dsh-sidecar-branch-restore{background:transparent;border:1px solid transparent;border-radius:.45rem;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:.78rem;max-width:10rem;padding:.25rem .35rem}.dsh-sidecar-branch-restore:hover,.dsh-sidecar-branch-restore:focus-visible{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-sidecar-branch-restore-active{background:var(--dsw-alias-state-business-tertiary);border-color:var(--dsw-alias-state-business-primary);box-shadow:inset 3px 0 0 var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);font-weight:600}.dsh-sidecar-branch-restore-active:hover,.dsh-sidecar-branch-restore-active:focus-visible{background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary)}
.dsh-sidecar-selection-action{align-items:center;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:.55rem;box-shadow:var(--dsw-shadow-lv2);color:var(--dsw-alias-label-primary);cursor:pointer;display:inline-flex;font-family:var(--dsw-font-family);font-size:.82rem;gap:.3rem;min-height:2rem;padding:.3rem .55rem;white-space:nowrap;z-index:79}
.dsh-sidecar-selection-action:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}.dsh-sidecar-selection-action:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.dsh-sidecar-selection-action:disabled{cursor:progress;opacity:.48}
.dsh-sidecar-drawer{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:.9rem;box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:var(--dsw-font-family);height:var(--dsh-sidecar-window-height);left:var(--dsh-sidecar-window-left);overflow:hidden;position:fixed;top:var(--dsh-sidecar-window-top);width:var(--dsh-sidecar-window-width);z-index:80}
.dsh-sidecar-window-resize{position:absolute;touch-action:none;z-index:1}
.dsh-sidecar-window-resize-n{cursor:ns-resize;height:6px;left:10px;right:10px;top:0}
.dsh-sidecar-window-resize-s{bottom:0;cursor:ns-resize;height:6px;left:10px;right:10px}
.dsh-sidecar-window-resize-w{bottom:10px;cursor:ew-resize;left:0;top:10px;width:6px}
.dsh-sidecar-window-resize-e{bottom:10px;cursor:ew-resize;right:0;top:10px;width:6px}
.dsh-sidecar-window-resize-nw{cursor:nwse-resize;height:14px;left:0;top:0;width:14px}
.dsh-sidecar-window-resize-ne{cursor:nesw-resize;height:14px;right:0;top:0;width:14px}
.dsh-sidecar-window-resize-sw{bottom:0;cursor:nesw-resize;height:14px;left:0;width:14px}
.dsh-sidecar-window-resize-se{bottom:0;cursor:nwse-resize;height:16px;right:0;width:16px}
.dsh-sidecar-window-resize-se:after{border-bottom:2px solid var(--dsw-alias-label-tertiary);border-radius:0 0 .2rem 0;border-right:2px solid var(--dsw-alias-label-tertiary);bottom:3px;content:"";height:7px;opacity:.7;position:absolute;right:3px;width:7px}
.dsh-sidecar-highlight{background:var(--dsw-alias-state-warn-tertiary);border-bottom:1px solid var(--dsw-alias-state-warn-secondary);border-radius:.25rem;box-decoration-break:clone;color:inherit;cursor:pointer;padding:0 .1em}
.dsh-sidecar-highlight:hover{background:var(--dsw-alias-state-warn-secondary)}
.dsh-sidecar-highlight:focus-visible{outline:2px solid var(--dsw-alias-state-warn-primary);outline-offset:1px}
.dsh-sidecar-header{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l2);cursor:grab;display:flex;gap:.35rem;justify-content:space-between;min-height:3.5rem;padding:0 .75rem;user-select:none}
.dsh-sidecar-header:active{cursor:grabbing}
.dsh-sidecar-header div{display:flex;flex:1;flex-direction:column;gap:.1rem;min-width:0}.dsh-sidecar-header small{color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-sidecar-header .dsh-sidecar-window-handle{align-items:center;background:transparent;border:0;border-radius:.4rem;color:var(--dsw-alias-label-tertiary);cursor:grab;display:inline-flex;flex:0 0 auto;font:inherit;font-size:1rem;height:1.9rem;justify-content:center;line-height:1;padding:0;touch-action:none;user-select:none;width:1.4rem}
.dsh-sidecar-header .dsh-sidecar-window-handle:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-sidecar-header .dsh-sidecar-window-handle:active{cursor:grabbing}
.dsh-sidecar-header .dsh-sidecar-window-handle:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.dsh-sidecar-header .dsh-sidecar-window-reset{background:transparent;border:0;border-radius:.45rem;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;font-size:.76rem;padding:.3rem .45rem;white-space:nowrap}
.dsh-sidecar-header .dsh-sidecar-window-reset:hover,.dsh-sidecar-header .dsh-sidecar-window-reset:focus-visible{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-sidecar-header .dsh-sidecar-close{background:transparent;border:0;border-radius:999px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:1.5rem;line-height:1;padding:0 .3rem}
.dsh-sidecar-header .dsh-sidecar-close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dsh-sidecar-header button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
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
.dsh-sidecar-responding{align-items:center;color:var(--dsw-alias-label-tertiary);display:flex;font-size:.82rem;gap:.5rem;padding:.45rem .1rem}.dsh-sidecar-responding-dot{animation:dsh-sidecar-pulse 1.1s ease-in-out infinite;background:var(--dsw-alias-state-business-primary);border-radius:999px;height:.5rem;width:.5rem}@keyframes dsh-sidecar-pulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}@media(prefers-reduced-motion:reduce){.dsh-sidecar-responding-dot{animation:none}}
.dsh-sidecar-error{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);margin:0;padding:.5rem 1rem}.dsh-sidecar-composer{border-top:1px solid var(--dsw-alias-border-l2);padding:.75rem}
.dsh-sidecar-composer textarea{background:var(--dsw-specific-input-major);border:1px solid var(--dsw-alias-border-l2);border-radius:.75rem;box-sizing:border-box;caret-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary);font:inherit;padding:.65rem .75rem;resize:vertical;width:100%}.dsh-sidecar-composer textarea::placeholder{color:var(--dsw-alias-label-caption)}
.dsh-sidecar-actions{display:flex;gap:.5rem;justify-content:flex-end;margin-top:.5rem}.dsh-sidecar-actions button{background:var(--dsw-specific-selector);border:0;border-radius:.55rem;color:var(--dsw-alias-label-primary);cursor:pointer;padding:.45rem .8rem}.dsh-sidecar-actions button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.dsh-sidecar-actions button:disabled{cursor:default;opacity:.45}
@media(max-width:760px){.dsh-sidecar-drawer{border:0;border-radius:0;height:100vh;left:0;top:0;width:100vw}.dsh-sidecar-header .dsh-sidecar-window-handle,.dsh-sidecar-window-resize{display:none}}
`
