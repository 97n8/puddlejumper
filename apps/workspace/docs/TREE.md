# Workspace Tree

```text
Workspace/
├── .github/
│   ├── workflows/
│   │   ├── deploy.yml
│   │   └── quality.yml
│   ├── copilot-instructions.md
│   ├── dependabot.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── api/
│   ├── civic/
│   │   └── staff.ts
│   ├── fiscal/
│   │   ├── municipalities.ts
│   │   └── sync.ts
│   ├── health/
│   │   └── anthropic.ts
│   ├── workspace/
│   │   ├── records/
│   │   └── intake.ts
│   └── puddles/
│       └── chat.ts
├── docs/
│   └── workspace-export.md
├── packages/
│   ├── archieve/
│   │   ├── src/
│   │   ├── .env
│   │   └── package.json
│   ├── case-api/
│   │   ├── data/
│   │   ├── src/
│   │   ├── .env
│   │   ├── package.json
│   │   └── POSTGRES_MIGRATION.md
│   ├── connector/
│   │   ├── src/
│   │   ├── .env
│   │   └── package.json
│   ├── discovery/
│   │   ├── src/
│   │   ├── .env
│   │   └── package.json
│   ├── formkey/
│   │   ├── src/
│   │   ├── .env
│   │   └── package.json
│   ├── portal/
│   │   ├── src/
│   │   ├── .env
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.js
│   ├── pulse/
│   │   ├── src/
│   │   ├── .env
│   │   └── package.json
│   ├── seal/
│   │   ├── src/
│   │   └── package.json
│   └── ui/
│       ├── src/
│       ├── .env
│       ├── index.html
│       ├── package.json
│       └── vite.config.js
├── public/
│   ├── _headers
│   ├── workspace-linkedin.png
│   ├── workspace-linkedin.webp
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── suzor-proposal.html
│   └── synchron8-linkedin.png
├── scripts/
├── src/
│   ├── assets/
│   │   └── images/
│   ├── components/
│   │   ├── layout/
│   │   ├── ui/
│   │   ├── vault/
│   │   ├── AccessGate.tsx
│   │   ├── BudgetEmbedPage.tsx
│   │   ├── ChangePasswordDialog.tsx
│   │   ├── CodeEditor.tsx
│   │   ├── InviteAcceptModal.tsx
│   │   ├── KeyboardShortcutsPanel.tsx
│   │   ├── LegalModal.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── LoginPage.test.tsx
│   │   ├── LoginPage.tsx
│   │   ├── MobileDesktopNudge.tsx
│   │   ├── MobileNav.tsx
│   │   ├── NotificationCenter.tsx
│   │   ├── PreviewPanel.tsx
│   │   ├── ProvisionDialog.tsx
│   │   ├── PuddleJumper.tsx
│   │   ├── RepoImportDialog.tsx
│   │   ├── SaveToCloudDialog.tsx
│   │   ├── SplashScreen.tsx
│   │   ├── Toolbar.tsx
│   │   ├── ToolErrorBoundary.tsx
│   │   ├── TownLoginPage.tsx
│   │   ├── TownSealPicker.tsx
│   │   ├── VaultCodeMirror.tsx
│   │   ├── VaultPanel.tsx
│   │   └── WorkspaceIcon.tsx
│   ├── context/
│   │   └── CloudSaveContext.tsx
│   ├── data/
│   │   ├── maMunicipalities.ts
│   │   └── townSeals.ts
│   ├── environments/
│   │   ├── aed/
│   │   ├── civic/
│   │   ├── grants/
│   │   ├── health/
│   │   └── ops/
│   ├── features/
│   │   ├── admin/
│   │   ├── aed/
│   │   ├── audit/
│   │   ├── boardcompliance/
│   │   ├── budgeting/
│   │   ├── builder/
│   │   ├── capitalprojects/
│   │   ├── cgm/
│   │   ├── civic/
│   │   ├── civicpulse/
│   │   ├── clerk/
│   │   ├── comms/
│   │   ├── connections/
│   │   ├── demo/
│   │   ├── devtools/
│   │   ├── environments/
│   │   ├── evidence/
│   │   ├── file-editor/
│   │   ├── fix/
│   │   ├── flows/
│   │   ├── formkey/
│   │   ├── govai/
│   │   ├── grantsworkflow/
│   │   ├── intake/
│   │   ├── logicbridge/
│   │   ├── logicbuilder/
│   │   ├── logiccommons/
│   │   ├── logicdash/
│   │   ├── marketplace/
│   │   ├── modules/
│   │   ├── onboard/
│   │   ├── orgmanager/
│   │   ├── permitbridge/
│   │   ├── permitting/
│   │   ├── procurement/
│   │   ├── puddles/
│   │   ├── quickstart/
│   │   ├── records/
│   │   ├── routingengine/
│   │   ├── settings/
│   │   ├── staffhr/
│   │   ├── start/
│   │   ├── stay/
│   │   ├── syncronate/
│   │   ├── time/
│   │   ├── town/
│   │   ├── townfinder/
│   │   ├── vault/
│   │   ├── vaultmgl/
│   │   ├── watchlayer/
│   │   └── .DS_Store
│   ├── framework/
│   │   ├── EnvironmentShell.tsx
│   │   └── types.ts
│   ├── hooks/
│   │   ├── use-mobile.ts
│   │   ├── use-subscription.ts
│   │   ├── useConnectorStatus.ts
│   │   ├── useKV.ts
│   │   └── useMobileMode.ts
│   ├── lib/
│   │   ├── workspace/
│   │   ├── anchors.ts
│   │   ├── api.ts
│   │   ├── colorContext.tsx
│   │   ├── documentUtils.ts
│   │   ├── environmentAccess.ts
│   │   ├── fileUtils.ts
│   │   ├── logger.ts
│   │   ├── membership.ts
│   │   ├── suttonDemo.ts
│   │   ├── tools-registry.ts
│   │   ├── types.ts
│   │   ├── utils.ts
│   │   └── vault-modules.ts
│   ├── services/
│   │   ├── auth/
│   │   ├── pj/
│   │   ├── casespaceApi.ts
│   │   ├── googlePJService.ts
│   │   ├── microsoftPJService.ts
│   │   ├── pjApi.ts
│   │   ├── pjBase.ts
│   │   └── serverPrefsCache.ts
│   ├── styles/
│   │   └── theme.css
│   ├── test/
│   │   ├── components/
│   │   ├── environments/
│   │   ├── features/
│   │   ├── framework/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── workspace/
│   │   ├── services/
│   │   └── setup.ts
│   ├── App.tsx
│   ├── ErrorFallback.tsx
│   ├── index.css
│   ├── main.css
│   ├── main.tsx
│   └── vite-end.d.ts
├── .DS_Store
├── .env.example
├── .env.local
├── .gitignore
├── .npmrc
├── .spark-initial-sha
├── ARCHITECTURE.md
├── components.json
├── deploy.sh
├── eslint.config.js
├── index.html
├── LICENSE
├── package-lock.json
├── package.json
├── pnpm-lock.yaml
├── PRD.md
├── README.md
├── SECURITY.md
├── spark.meta.json
├── tailwind.config.js
├── tsconfig.json
├── vercel.json
├── vite.config.ts
└── vitest.config.ts
```
