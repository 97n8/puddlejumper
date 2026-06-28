import { describe, expect, it } from 'vitest'
import { DATA_SOURCES, DEMO_MODULES } from '@/features/environments/demo/townCaseDemoData'
import {
  buildEnvironmentArtifacts,
  buildImplementationPacket,
} from '@/features/environments/demo/townCaseDemoUtils'

describe('townCase demo utilities', () => {
  it('builds implementation content with the full provisioning stack', () => {
    const packet = buildImplementationPacket(
      'Sutton',
      DEMO_MODULES[0],
      'Build',
      'Lean municipal team with board-heavy governance.',
      DATA_SOURCES.slice(0, 2),
    )

    expect(packet).toContain('## Provisioning stack')
    expect(packet).toContain('LogicDASH')
    expect(packet).toContain('Live Connections')
  })

  it('includes provisioning tools in the environment blueprint artifact', () => {
    const artifacts = buildEnvironmentArtifacts(
      'Sutton',
      DEMO_MODULES[0],
      'Build',
      'Lean municipal team with board-heavy governance.',
      DATA_SOURCES.slice(0, 2),
      '# Demo packet',
      'Build the lane into a governed operating system.',
    )

    const blueprint = artifacts.find(artifact => artifact.filename.includes('environment-blueprint'))
    expect(blueprint?.content).toContain('"tools"')
    expect(blueprint?.content).toContain('LogicBridge')
  })
})
