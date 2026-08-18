import type {
  ConnectionHandle,
  SessionId,
} from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'

import { SidecarAction } from './components/SidecarAction.js'
import { SidecarDrawer } from './components/SidecarDrawer.js'
import { ForkController } from './controllers/fork-controller.js'
import { HarnessHistorySource } from './controllers/harness-history-source.js'
import { PersistentAnchorRepository } from './controllers/persistent-anchor-repository.js'
import { HarnessSessionGateway } from './controllers/session-gateway.js'
import {
  SIDECAR_LOCALES,
  SIDECAR_LOCALE_NAMESPACE,
} from './locales.js'
import { SidecarController } from './controllers/sidecar-controller.js'
import { STYLE_TEXT } from './styles.js'

export const inject = ['slots', 'sessions', 'workspaces', 'connection', 'locale']

/** Browser half assembled only from exported Harness 0.1.0-rc.6 contracts. */
export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as ConnectionHandle | undefined
  if (connection === undefined) throw new Error('dsh-sidecar requires ctx.connection')

  const history = new HarnessHistorySource(ctx.sessions, connection.api)
  const anchors = new PersistentAnchorRepository(connection.rpc)
  const gateway = new HarnessSessionGateway(ctx.sessions, connection.api)
  const forks = new ForkController(gateway, anchors)
  const controller = new SidecarController(
    forks,
    gateway,
    ctx.sessions,
    ctx.workspaces,
    anchors,
  )

  ctx.effect(
    () => ctx.locale.register(SIDECAR_LOCALE_NAMESPACE, SIDECAR_LOCALES),
    'dsh-sidecar: locales',
  )

  ctx.effect(() => {
    const element = document.createElement('style')
    element.dataset.dshSidecar = 'styles'
    element.textContent = STYLE_TEXT
    document.head.append(element)
    return () => element.remove()
  }, 'dsh-sidecar: styles')

  ctx.slots.inject('conversation.chat.assistant-actions', () =>
    ctx.slots.register(
      {
        id: 'sidecar',
        inject: () => ({ controller }),
        locale: SIDECAR_LOCALE_NAMESPACE,
        name: 'conversation.chat.assistant-actions',
        order: 20,
      },
      SidecarAction,
    ),
  )

  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      {
        id: 'sidecar',
        inject: () => ({
          controller,
          gateway,
          history,
          openSession: (sessionId: string) => ctx.sessions.open(sessionId as SessionId),
        }),
        locale: SIDECAR_LOCALE_NAMESPACE,
        name: 'shell.overlay',
        order: 20,
      },
      SidecarDrawer,
    ),
  )

  ctx.effect(
    () => () => {
      void controller.close()
    },
    'dsh-sidecar: lifecycle',
  )
}
