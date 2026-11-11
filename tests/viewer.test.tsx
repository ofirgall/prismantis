import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { diagramKind, viewerCommand, viewerFile } from '../hooks/viewer'
import { clipboardEnv, recordToasts, runResult, startSession } from './clipboard-env'

const diagram = '```mermaid\ngraph LR\n  A --> B\n```'

const mount = (text: string) => ({
  plugin: 'prismantis',
  component: 'AssistantMessage' as const,
  props: { text, isFirstOfReply: true },
  viewport: { columns: 100, rows: 40 },
  surface: 'terminal' as const,
})

const recordRuns = (on: On) => {
  const runs: (readonly string[])[] = []
  on('process.run', (_, e) => {
    runs.push(e.argv)
    return runResult(0)
  })
  return runs
}

const recordWrites = (on: On) => {
  const writes: { path: string; text: string }[] = []
  on('fs.write', (_, e) => {
    writes.push({ path: e.path, text: e.text })
    return { value: undefined }
  })
  return writes
}

test('mermaidView inline draws the diagram with no open button', async ($, on) => {
  clipboardEnv(on, 'macos', { TMPDIR: '/tmp/' })
  await startSession($, on)
  const ui = await $.ui.mount(mount(diagram))
  expect(await ui.find({ key: 'view0' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^graph · 2 lines$/ })).toBeUndefined()
  await ui.unmount()
})

test('mermaidView viewer draws a card and opens the diagram as a .md file', { options: { mermaidView: 'viewer' } }, async ($, on) => {
  clipboardEnv(on, 'macos', { TMPDIR: '/tmp/' })
  const runs = recordRuns(on)
  const writes = recordWrites(on)
  const toasts = recordToasts(on)
  await startSession($, on)
  const ui = await $.ui.mount(mount(diagram))
  expect(await ui.find({ type: 'Text', text: /^graph · 2 lines$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /─/ })).toBeUndefined()
  await ui.press({ key: 'view0' })
  expect(writes).toHaveLength(1)
  expect(writes[0]!.path).toMatch(/^\/tmp\/prismantis-mermaid\/diagram-[0-9a-z]+\.md$/)
  expect(writes[0]!.text).toBe('```mermaid\ngraph LR\n  A --> B\n```\n')
  expect(runs).toEqual([['/usr/bin/open', writes[0]!.path]])
  expect(toasts[0]).toMatch(/^Opened diagram-/)
  await ui.unmount()
})

test('mermaidView both keeps the drawing and adds the open button', { options: { mermaidView: 'both', mermaidViewer: 'code --reuse-window' } }, async ($, on) => {
  clipboardEnv(on, 'macos', { TMPDIR: '/tmp' })
  const runs = recordRuns(on)
  recordWrites(on)
  await startSession($, on)
  const ui = await $.ui.mount(mount(diagram))
  expect(await ui.find({ type: 'Text', text: /─/ })).toBeDefined()
  await ui.press({ key: 'view0' })
  expect(runs[0]!.slice(0, 2)).toEqual(['code', '--reuse-window'])
  expect(runs[0]![2]).toMatch(/\.md$/)
  await ui.unmount()
})

test('mermaidView viewer leaves a diagram still streaming as source', { options: { mermaidView: 'viewer' } }, async ($, on) => {
  clipboardEnv(on, 'macos')
  await startSession($, on)
  const ui = await $.ui.mount(mount('```mermaid\ngraph LR\n  A --> B'))
  expect(await ui.find({ key: 'view0' })).toBeUndefined()
  await ui.unmount()
})

test('viewerCommand picks the platform opener or the configured program', () => {
  expect(viewerCommand('/t/d.md', '', 'macos')).toEqual(['/usr/bin/open', '/t/d.md'])
  expect(viewerCommand('/t/d.md', '', 'linux')).toEqual(['xdg-open', '/t/d.md'])
  expect(viewerCommand('C:/t/d.md', '', 'windows', 'C:\\Windows')).toEqual(['C:\\Windows\\explorer.exe', 'C:\\t\\d.md'])
  expect(viewerCommand('C:/t/d.md', '', 'windows')).toBeNull()
  expect(viewerCommand('/t/d.md', '', null)).toBeNull()
  expect(viewerCommand('/t/d.md', ' open -a  Typora ', null)).toEqual(['open', '-a', 'Typora', '/t/d.md'])
  expect(diagramKind('%% note\nsequenceDiagram\n  A->>B: hi')).toBe('sequenceDiagram')
  expect(diagramKind('xychart-beta\n  bar [1, 2]')).toBe('xychart-beta')
  expect(viewerFile('pie\n  "a" : 1').name).toBe(viewerFile('pie\n  "a" : 1').name)
})
