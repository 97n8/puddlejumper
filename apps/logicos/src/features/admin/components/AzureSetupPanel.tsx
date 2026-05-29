import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check, X, Copy, Warning, Info, MicrosoftExcelLogo } from '@phosphor-icons/react'
import { toast } from 'sonner'

export function AzureSetupPanel() {
  const azureClientId = import.meta.env.VITE_AZURE_CLIENT_ID || ''
  const azureTenantId = import.meta.env.VITE_AZURE_TENANT_ID || ''
  const azureAuthority = import.meta.env.VITE_AZURE_AUTHORITY || 'common'
  const redirectUri = import.meta.env.VITE_REDIRECT_URI || window.location.origin
  
  const isConfigured = !!azureClientId && !!azureTenantId

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const requiredPermissions = [
    { name: 'User.Read',              description: 'Read signed-in user profile (name, email, photo)' },
    { name: 'Files.ReadWrite',        description: 'Read and write the signed-in user\'s own files (not all org files)' },
    { name: 'Sites.Read.All',         description: 'Read SharePoint sites the user has access to' },
    { name: 'Mail.Send',              description: 'Send mail on behalf of the signed-in user only' },
    { name: 'Calendars.ReadWrite',    description: 'Read and write the signed-in user\'s calendar' },
    { name: 'Tasks.ReadWrite',        description: 'Read and write the signed-in user\'s To-Do tasks' },
    { name: 'Team.ReadBasic.All',     description: 'Read basic Teams info the user is a member of' },
    { name: 'offline_access',         description: 'Maintain access while the user is not actively using the app' },
  ]

  return (
    <div className="flex-1 overflow-hidden bg-background">
      <div className="h-full flex flex-col">
        <div className="flex-none px-8 py-6 border-b border-border bg-card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <MicrosoftExcelLogo size={32} weight="fill" className="text-[#0078D4]" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-display font-semibold text-foreground">
                Azure AD OAuth Configuration
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Configure Microsoft 365 integration for your LogicWorkspace
              </p>
            </div>
            {isConfigured ? (
              <Badge className="bg-accent text-accent-foreground">
                <Check size={14} className="mr-1" />
                Configured
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                <Warning size={14} className="mr-1" />
                Not Configured
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-8 max-w-5xl mx-auto space-y-6">
            <Alert>
              <Info size={16} className="mt-0.5" />
              <AlertDescription>
                This guide helps you configure real Azure AD OAuth for production Microsoft 365 integration. 
                Once configured, users can authenticate with their Microsoft accounts and access OneDrive, SharePoint, Teams, and more.
              </AlertDescription>
            </Alert>

            <Tabs defaultValue="status" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="status">Status</TabsTrigger>
                <TabsTrigger value="setup">Setup Guide</TabsTrigger>
                <TabsTrigger value="permissions">Permissions</TabsTrigger>
                <TabsTrigger value="testing">Testing</TabsTrigger>
              </TabsList>

              <TabsContent value="status" className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-display font-semibold mb-4">Current Configuration</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Client ID</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={azureClientId || 'Not configured'}
                          readOnly
                          className="font-mono text-sm"
                        />
                        {azureClientId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(azureClientId, 'Client ID')}
                          >
                            <Copy size={16} />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Tenant ID</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={azureTenantId || 'Not configured'}
                          readOnly
                          className="font-mono text-sm"
                        />
                        {azureTenantId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(azureTenantId, 'Tenant ID')}
                          >
                            <Copy size={16} />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Authority</Label>
                      <Input
                        value={azureAuthority}
                        readOnly
                        className="font-mono text-sm mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use 'common' for multi-tenant or your tenant ID for single-tenant
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Redirect URI</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={redirectUri}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(redirectUri, 'Redirect URI')}
                        >
                          <Copy size={16} />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        This must be configured in your Azure AD app registration
                      </p>
                    </div>
                  </div>
                </Card>

                {!isConfigured && (
                  <Alert variant="destructive">
                    <Warning size={16} className="mt-0.5" />
                    <AlertDescription>
                      <strong>Action Required:</strong> Configure your environment variables to enable Microsoft 365 integration.
                      See the Setup Guide tab for instructions.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="setup" className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-display font-semibold mb-4">Step 1: Create Azure AD App Registration</h3>
                  <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                    <li>Go to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Azure Portal</a></li>
                    <li>Navigate to <strong>Azure Active Directory</strong> → <strong>App registrations</strong> → <strong>New registration</strong></li>
                    <li>Configure your app:
                      <ul className="list-disc list-inside ml-5 mt-2 space-y-1">
                        <li><strong>Name:</strong> LogicWorkspace</li>
                        <li><strong>Supported account types:</strong> Accounts in any organizational directory and personal Microsoft accounts</li>
                        <li><strong>Redirect URI:</strong> Single-page application (SPA) - <code className="bg-muted px-1 py-0.5 rounded text-xs">{redirectUri}</code></li>
                      </ul>
                    </li>
                  </ol>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-display font-semibold mb-4">Step 2: Configure Authentication</h3>
                  <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                    <li>Go to <strong>Authentication</strong> in your app registration</li>
                    <li>Under <strong>Implicit grant and hybrid flows</strong>:
                      <ul className="list-disc list-inside ml-5 mt-2 space-y-1">
                        <li>✅ Check <strong>Access tokens</strong></li>
                        <li>✅ Check <strong>ID tokens</strong></li>
                      </ul>
                    </li>
                    <li>Save changes</li>
                  </ol>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-display font-semibold mb-4">Step 3: Add API Permissions</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Go to <strong>API permissions</strong> → <strong>Add a permission</strong> → <strong>Microsoft Graph</strong> → <strong>Delegated permissions</strong>
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">Add the permissions listed in the Permissions tab, then click <strong>Grant admin consent</strong></p>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-display font-semibold mb-4">Step 4: Get Your Credentials</h3>
                  <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                    <li>Go to <strong>Overview</strong> in your app registration</li>
                    <li>Copy the <strong>Application (client) ID</strong></li>
                    <li>Copy the <strong>Directory (tenant) ID</strong></li>
                  </ol>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-display font-semibold mb-4">Step 5: Configure Environment Variables</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Create a <code className="bg-muted px-1 py-0.5 rounded">.env</code> file in your project root:
                  </p>
                  <div className="bg-muted rounded-lg p-4 font-mono text-xs space-y-1">
                    <div>VITE_AZURE_CLIENT_ID=your-client-id-here</div>
                    <div>VITE_AZURE_TENANT_ID=your-tenant-id-here</div>
                    <div>VITE_AZURE_AUTHORITY=common</div>
                    <div>VITE_REDIRECT_URI={redirectUri}</div>
                  </div>
                  <Button
                    className="mt-3"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(
                      `VITE_AZURE_CLIENT_ID=your-client-id-here\nVITE_AZURE_TENANT_ID=your-tenant-id-here\nVITE_AZURE_AUTHORITY=common\nVITE_REDIRECT_URI=${redirectUri}`,
                      'Environment variables template'
                    )}
                  >
                    <Copy size={16} className="mr-2" />
                    Copy Template
                  </Button>
                </Card>

                <Alert>
                  <Info size={16} className="mt-0.5" />
                  <AlertDescription>
                    <strong>Important:</strong> After creating the .env file, restart your development server for changes to take effect.
                  </AlertDescription>
                </Alert>
              </TabsContent>

              <TabsContent value="permissions" className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-display font-semibold mb-4">Required Microsoft Graph Permissions</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    These delegated permissions must be configured in your Azure AD app registration:
                  </p>
                  <div className="space-y-3">
                    {requiredPermissions.map((permission) => (
                      <div key={permission.name} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <Check size={20} className="text-accent mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm font-medium text-foreground">{permission.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{permission.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-display font-semibold mb-4">What Users Can Do</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium text-sm mb-1">OneDrive Files</p>
                      <p className="text-xs text-muted-foreground">Create, read, update, and delete files in OneDrive</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium text-sm mb-1">SharePoint Sites</p>
                      <p className="text-xs text-muted-foreground">Access and manage SharePoint sites and lists</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium text-sm mb-1">Email</p>
                      <p className="text-xs text-muted-foreground">Send emails on behalf of the user</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium text-sm mb-1">Calendar</p>
                      <p className="text-xs text-muted-foreground">Create and manage calendar events</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium text-sm mb-1">Teams</p>
                      <p className="text-xs text-muted-foreground">Create and manage Microsoft Teams</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium text-sm mb-1">User Profile</p>
                      <p className="text-xs text-muted-foreground">Read user profile information</p>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="testing" className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-display font-semibold mb-4">Test Your Configuration</h3>
                  
                  {isConfigured ? (
                    <div className="space-y-4">
                      <Alert className="bg-accent/10 border-accent">
                        <Check size={16} className="mt-0.5 text-accent" />
                        <AlertDescription className="text-accent-foreground">
                          Your configuration looks good! Follow these steps to test:
                        </AlertDescription>
                      </Alert>

                      <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                        <li>Navigate to the start screen</li>
                        <li>Click the <strong>Connections</strong> button in PuddleJumper or toolbar</li>
                        <li>Select <strong>Microsoft 365</strong></li>
                        <li>Click <strong>Connect</strong></li>
                        <li>You should be redirected to Microsoft login</li>
                        <li>After authentication, you'll return to LogicWorkspace</li>
                        <li>Your connection should show as "Connected" with a green indicator</li>
                        <li>Click <strong>Manage</strong> to test file operations</li>
                      </ol>
                    </div>
                  ) : (
                    <Alert variant="destructive">
                      <X size={16} className="mt-0.5" />
                      <AlertDescription>
                        Cannot test until configuration is complete. Please follow the Setup Guide first.
                      </AlertDescription>
                    </Alert>
                  )}
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-display font-semibold mb-4">Troubleshooting</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="font-medium text-sm mb-1">Error: "redirect_uri mismatch"</p>
                      <p className="text-xs text-muted-foreground">
                        Ensure your redirect URI in .env exactly matches one configured in Azure AD app registration
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-sm mb-1">Error: "invalid_client"</p>
                      <p className="text-xs text-muted-foreground">
                        Double-check your client ID is correct and your app registration is active
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-sm mb-1">Error: "consent_required"</p>
                      <p className="text-xs text-muted-foreground">
                        Admin consent may be required for some permissions. Ask your tenant admin to grant consent
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-sm mb-1">Error: "unauthorized_client"</p>
                      <p className="text-xs text-muted-foreground">
                        Ensure you've enabled "Access tokens" and "ID tokens" in Authentication settings
                      </p>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
