import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApprovalQueueView } from './operatorUI/approvalQueue/ApprovalQueueView'
import { BackstopStatusPanel } from './operatorUI/backstop/BackstopStatusPanel'
import { ComplianceAlertBanner } from './operatorUI/backstop/ComplianceAlertBanner'
import { PublicationLogView } from './operatorUI/auditLog/PublicationLogView'
import { ChannelConfigPanel } from './operatorUI/channelConfig/ChannelConfigPanel'
import { ApprovalBehaviorSettings } from './operatorUI/channelConfig/ApprovalBehaviorSettings'
import { TownActivityFeed } from './publicFeed/TownActivityFeed'
import { civicpulseClient } from '../api/civicpulseClient'
import { Broadcast, CheckSquare, ListChecks, Gear, ClipboardText } from '@phosphor-icons/react'

interface CivicPulsePanelProps {
  onOpenEnvironment?: (envId: string) => void
}

export function CivicPulsePanel({ onOpenEnvironment: _onOpenEnvironment }: CivicPulsePanelProps) {
  const [backstopCount, setBackstopCount] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState('queue')
  const [backstopUnavailable, setBackstopUnavailable] = useState(false)

  useEffect(() => {
    civicpulseClient.getBackstopItems()
      .then(items => {
        setBackstopCount(items.filter(i => !i.resolved).length)
        setBackstopUnavailable(false)
      })
      .catch(() => {
        setBackstopCount(null)
        setBackstopUnavailable(true)
      })
  }, [])

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <Broadcast size={22} weight="duotone" className="text-primary shrink-0" />
          <div>
            <h1 className="text-base font-semibold text-foreground leading-none">CivicPulse</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Automated Civic Transparency Engine · VAULT Signal Module</p>
          </div>
        </div>

        {backstopUnavailable && (
          <div className="mt-3">
            <p className="text-xs text-destructive">Compliance status unavailable.</p>
          </div>
        )}

        {backstopCount !== null && backstopCount > 0 && (
          <div className="mt-3">
            <ComplianceAlertBanner count={backstopCount} onView={() => setActiveTab('backstop')} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="border-b border-border px-6 shrink-0">
            <TabsList className="h-10 bg-transparent gap-0 p-0 rounded-none">
              <TabsTrigger value="queue" className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm gap-1.5 px-4">
                <CheckSquare size={14} weight="duotone" />
                Approval Queue
              </TabsTrigger>
              <TabsTrigger value="feed" className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm gap-1.5 px-4">
                <Broadcast size={14} weight="duotone" />
                Activity Feed
              </TabsTrigger>
              <TabsTrigger value="backstop" className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm gap-1.5 px-4">
                <ListChecks size={14} weight="duotone" />
                Compliance
              </TabsTrigger>
              <TabsTrigger value="log" className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm gap-1.5 px-4">
                <ClipboardText size={14} weight="duotone" />
                Publication Log
              </TabsTrigger>
              <TabsTrigger value="config" className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm gap-1.5 px-4">
                <Gear size={14} weight="duotone" />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <TabsContent value="queue" className="m-0 p-6">
              <ApprovalQueueView />
            </TabsContent>

            <TabsContent value="feed" className="m-0 p-6">
              <TownActivityFeed />
            </TabsContent>

            <TabsContent value="backstop" className="m-0 p-6">
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Compliance Windows</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Actions approaching or past their required communication window.</p>
                </div>
                <BackstopStatusPanel />
              </div>
            </TabsContent>

            <TabsContent value="log" className="m-0 p-6">
              <PublicationLogView />
            </TabsContent>

            <TabsContent value="config" className="m-0 p-6 space-y-8">
              <div>
                <h2 className="text-base font-semibold text-foreground">Output Channels</h2>
                <p className="text-xs text-muted-foreground mt-0.5 mb-4">Enable output channels and set approval behavior per channel.</p>
                <ChannelConfigPanel />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Approval Behavior by Action Type</h2>
                <p className="text-xs text-muted-foreground mt-0.5 mb-4">Override default approval behavior for specific municipal action types.</p>
                <ApprovalBehaviorSettings />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
