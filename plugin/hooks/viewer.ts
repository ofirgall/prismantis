import type { ClipboardBackend } from './clipboard'
import { instanceKey } from './render'

export const viewerFile = (source: string): { name: string; text: string } => ({
  name: `diagram-${instanceKey(source)}.md`,
  text: `\`\`\`mermaid\n${source}\n\`\`\`\n`,
})

export const viewerDir = (tmp: string): string => `${tmp.replace(/[\\/]+$/, '')}/prismantis-mermaid`

export const diagramKind = (source: string): string => {
  const first = source.split('\n').map(line => line.trim()).find(line => line !== '' && !line.startsWith('%%') && line !== '---')
  return first?.split(/[\s:;{]/)[0] || 'mermaid'
}

export const viewerCommand = (path: string, custom: string, platform: ClipboardBackend | null, systemRoot?: string): string[] | null => {
  const words = custom.trim().split(/\s+/).filter(Boolean)
  if (words.length) return [...words, path]
  if (platform === 'macos') return ['/usr/bin/open', path]
  if (platform === 'windows') return systemRoot ? [`${systemRoot}\\explorer.exe`, path.replace(/\//g, '\\')] : null
  if (platform === 'linux') return ['xdg-open', path]
  return null
}
