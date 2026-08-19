import type { LocaleId } from '@deepseek-ai/dsh-client-locale/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

export const SIDECAR_LOCALE_NAMESPACE = 'dsh-sidecar'

const zh = {
  'action.ask': '追问',
  'action.askSelection': '追问选中内容',
  'action.opening': '正在打开追问',
  'action.openingTitle': '正在创建或恢复分支…',
  'action.title': '在侧边栏中追问，不改动主对话',
  'action.selectionTitle': '立即针对选中内容追问',
  'archive.cancel': '取消归档',
  'archive.confirm': '确认归档',
  'archive.group': '确认归档当前分支',
  'archive.prompt': '归档此分支？',
  'branch.archive': '归档',
  'branch.archiveAria': '归档当前分支',
  'branch.fallback': '分支 {number}',
  'branch.label': '侧边追问分支',
  'branch.new': '＋ 新建',
  'branch.newAria': '新建分支',
  'branch.rename': '重命名',
  'branch.renameAria': '重命名当前分支',
  'composer.aria': '侧边追问',
  'composer.context': '已继承所选回答之前的上下文；下面只显示分支新增内容。',
  'composer.empty': '输入一个针对性追问。',
  'composer.placeholder': '继续追问…（Enter 发送，Shift+Enter 换行）',
  'composer.send': '发送',
  'composer.sending': '发送中…',
  'composer.stop': '停止',
  'drawer.aria': '侧边追问',
  'drawer.close': '关闭侧边追问',
  'drawer.openError': '无法打开分支，请先检查已有分支。',
  'drawer.opening': '正在创建或恢复分支…',
  'drawer.subtitle': '独立保存 · 不写入主对话',
  'drawer.title': '侧边追问',
  'excerpt.prompt': '针对以下选中片段：',
  'pending.approval': '侧边会话正在等待工具审批。',
  'pending.open': '打开子会话处理',
  'pending.plan': '侧边会话正在等待计划确认。',
  'pending.question': '侧边会话正在等待你的回答。',
  'rename.cancel': '取消',
  'rename.input': '分支名称',
  'rename.save': '保存名称',
  'role.assistant': 'AI',
  'role.status': '状态',
  'role.user': '你',
} as const

export type SidecarLocaleKey = keyof typeof zh

const en: Record<SidecarLocaleKey, string> = {
  'action.ask': 'Ask follow-up',
  'action.askSelection': 'Ask about selected text',
  'action.opening': 'Opening follow-up',
  'action.openingTitle': 'Creating or restoring branch…',
  'action.title': 'Ask in the side panel without changing the main conversation',
  'action.selectionTitle': 'Ask about the selected text now',
  'archive.cancel': 'Cancel',
  'archive.confirm': 'Archive',
  'archive.group': 'Confirm branch archive',
  'archive.prompt': 'Archive this branch?',
  'branch.archive': 'Archive',
  'branch.archiveAria': 'Archive current branch',
  'branch.fallback': 'Branch {number}',
  'branch.label': 'Follow-up branch',
  'branch.new': '＋ New',
  'branch.newAria': 'Create branch',
  'branch.rename': 'Rename',
  'branch.renameAria': 'Rename current branch',
  'composer.aria': 'Side follow-up',
  'composer.context': 'Context through the selected answer is inherited; only new branch content appears below.',
  'composer.empty': 'Enter a focused follow-up.',
  'composer.placeholder': 'Continue… (Enter to send, Shift+Enter for a new line)',
  'composer.send': 'Send',
  'composer.sending': 'Sending…',
  'composer.stop': 'Stop',
  'drawer.aria': 'Side follow-up',
  'drawer.close': 'Close side follow-up',
  'drawer.openError': 'Unable to open the branch. Check existing branches first.',
  'drawer.opening': 'Creating or restoring branch…',
  'drawer.subtitle': 'Saved separately · Main conversation unchanged',
  'drawer.title': 'Side follow-up',
  'excerpt.prompt': 'Regarding this selected excerpt:',
  'pending.approval': 'The side session is waiting for tool approval.',
  'pending.open': 'Open child session',
  'pending.plan': 'The side session is waiting for plan confirmation.',
  'pending.question': 'The side session is waiting for your answer.',
  'rename.cancel': 'Cancel',
  'rename.input': 'Branch name',
  'rename.save': 'Save name',
  'role.assistant': 'AI',
  'role.status': 'Status',
  'role.user': 'You',
}

export const SIDECAR_LOCALES = { en, zh } satisfies Record<
  LocaleId,
  Record<SidecarLocaleKey, string>
>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-sidecar': SidecarLocaleKey
  }
}

export type SidecarTranslate = TranslateNS<typeof SIDECAR_LOCALE_NAMESPACE>
