# Workspace

A unified, interactive workspace combining four independent tools: **Pen** for live code editing, **Docs** for document creation, **Files** for file management, and **Commons** for GitHub repository operations. Designed to feel like one cohesive operating system where users can flow naturally between tools without barriers.

**Experience Qualities**:
1. **Approachable** - Warm, inviting interface that welcomes everyone, not just technical users
2. **Fluid** - Smooth interactions and thoughtful transitions that feel natural and human
3. **Refined** - Sophisticated color palette with warm accents, elegant design patterns, generous breathing room

**Complexity Level**: Light Application (multiple features with basic state)
Four focused tools with straightforward functionality. Start screen offers immediate access via large, clickable tool cards. Each tool occupies full screen when active with easy navigation back to the workspace chooser—no barriers, no confusion, just work.

## Essential Features

**Unified Workspace Launcher**
- Functionality: Four large, clickable tool cards with hover animations that immediately launch LogicPen, LogicDocs, DocDump, or LogicCommons
- Purpose: Zero-friction tool selection—no project names, no forms, just one click to start working
- Trigger: User visits the app
- Progression: Start screen → user clicks tool card → workspace opens instantly
- Success criteria: Single-click access to any tool, smooth card hover effects, instant tool launch

**LogicPen - Live Code Editor**
- Functionality: Split-panel code editor with HTML, CSS, and JavaScript tabs. Live preview updates automatically as you type. Export complete HTML file.
- Purpose: Quick web prototyping without heavy IDE setup, inspired by CodePen
- Trigger: User clicks LogicPen card on start screen
- Progression: Workspace opens → user switches between HTML/CSS/JS tabs → types code → sees live preview → exports HTML file
- Success criteria: Real-time preview updates, clean editor UI with syntax highlighting, smooth tab switching

**LogicDocs - Document Creator**
- Functionality: Create formatted documents (DOCX, PDF, HTML, Markdown) with side-by-side panels. Left panel for document creation, right panel (DocDump) for file organization. Save templates for reuse.
- Purpose: Quick document generation without opening desktop apps
- Trigger: User clicks LogicDocs card on start screen
- Progression: Workspace opens with LogicDocs panel → user types title and content → selects format → creates document → optionally saves as template → file appears in DocDump panel
- Success criteria: Documents download in correct format, templates save and load properly, two-panel layout feels integrated

**DocDump - Interactive File Organizer**
- Functionality: Drag-drop file uploads, create folders, drag files into folders, drag folders into each other, batch export as ZIP
- Purpose: Visual file organization with direct manipulation
- Trigger: User clicks DocDump card on start screen, or LogicDocs opens it automatically
- Progression: Workspace opens → files drop into zone → appear as cards → user creates folders → drags files/folders to organize → downloads as ZIP
- Success criteria: Smooth drag-and-drop, clear visual feedback during drag, folders organize hierarchically

**LogicCommons - Community Knowledge & GitHub Hub**
- Functionality: Expansive marketplace with 50+ professional templates across business (proposals, invoices, marketing plans, pitch decks, meeting notes, press releases, sprint retrospectives, PRDs), code (API docs, technical design, project READMEs), education (research papers, study notes, grant proposals), and personal (budgets, resumes, event planning) categories. Full-featured GitHub operations dashboard with repository browsing, file exploration with create/edit/delete capabilities, branch switching, commit history, issue tracking, pull request management, and workflow monitoring. Users can download templates, publish their own, and manage complete GitHub repositories directly in the workspace. Connect securely via personal access token to access all repositories and manage files directly in the browser.
- Purpose: One-stop knowledge base combining community-contributed templates for quick-start document creation with complete GitHub repository control and collaboration hub. Democratize access to professional templates while providing developers full Git workflow capabilities - view code structure, create and edit files, monitor activity, track issues and PRs, review commits, and manage workflows without leaving the workspace
- Trigger: User clicks LogicCommons card on start screen
- Progression: Workspace opens → user sees vast template marketplace organized by category → can search, filter, preview, and download any template → templates sync to LogicDocs for immediate use → user can also switch to GitHub tab → enters GitHub token → token saved → repositories load in sidebar → user selects repository → overview shows stats, languages, and recent workflows → user switches between tabs: Overview (repo stats, languages, workflows), Files (browse directory tree, switch branches, create new files, edit existing files, delete files), Issues (track all issues with labels), Pull Requests (review PRs with branch info) → Files tab: user navigates folders → clicks "New File" to create → opens editor with path and content → saves with commit message → file appears in tree → user can edit or delete existing files → changes commit directly to branch → users can also publish their own templates back to marketplace → all activity integrates seamlessly
- Success criteria: 50+ high-quality templates across diverse categories, instant template preview and download, smooth category navigation and search, template-to-LogicDocs integration, secure persistent token storage, fast API requests with proper error handling, intuitive file browser with folder navigation, create/edit/delete files with proper commit messages, file editor with syntax awareness, branch-aware file operations, smooth navigation, proper error handling for Git operations, complete GitHub integration, community template publishing workflow

**Seamless Navigation**
- Functionality: Back button in toolbar returns to start screen, maintaining all work and state
- Purpose: Feel like one unified workspace, not separate disconnected apps
- Trigger: User clicks back button in any tool
- Progression: Current tool → fade transition → start screen appears with preserved data
- Success criteria: Work is never lost, transition feels natural, users can freely move between tools

**Cloud Integrations**
- Functionality: OAuth-based connections to Microsoft 365 (OneDrive), Google Drive, and GitHub. Users authenticate once, then access their cloud files directly from DocDump, sync documents to cloud storage, and manage GitHub repositories in LogicCommons.
- Purpose: Seamless cloud file access and synchronization without leaving the workspace
- Trigger: User clicks "Connections" button in toolbar or PuddleJumper, selects provider, authenticates via OAuth
- Progression: Connections dialog opens → user selects provider (Microsoft/Google/GitHub) → OAuth redirect → authentication → return to app → token stored → cloud features enabled → files sync automatically
- Success criteria: OAuth flow completes successfully, tokens persist between sessions, cloud files appear in DocDump, GitHub repos accessible in LogicCommons, no manual copy/paste needed

## Edge Case Handling

**Empty States** - DocDump with no files shows inviting drop zone with icon; LogicPen shows clean empty editor; Templates tab shows "No templates yet" with helpful text

**File Errors** - Duplicate names auto-append numbers; unsupported types show toast; large files show size in UI but still allow

**Drag Interactions** - Visual feedback during drag (drop targets highlight); invalid drop targets don't respond; drag state clears properly on drop or cancel

**Data Limits** - Browser storage handles up to 1000 files and 100 templates gracefully

**Navigation State** - Back button always returns to start screen; all work persists when switching tools; users can explore freely without losing progress

**OAuth Failures** - Clear error messages if authentication fails; retry option available; works offline without cloud connections; local features unaffected by connection issues

## Design Direction

Warm, approachable, and inviting with a focus on feeling like one cohesive workspace for everyone. Interface uses generous spacing, soft shadows, and smooth transitions. Earthy coral and sage green accents create personality while maintaining an accessible, human feel. Generous rounded corners throughout create welcoming atmosphere. Typography is clean, refined, and highly readable. Each tool feels like part of the same family, sharing visual language and interaction patterns. No barriers between tools—just seamless flow. The design avoids technical intimidation, instead focusing on clarity and ease of use for all skill levels.

## Color Selection

Fresh, natural palette centered around vibrant greens with organic earth tones.

- **Primary Color**: Vibrant Green (oklch(0.65 0.18 155)) - Main actions, growth, natural energy
- **Secondary Colors**: 
  - Soft Cream Background (oklch(0.97 0.01 85)) - Warm canvas that feels inviting
  - Light Cards (oklch(0.99 0.005 85)) - Elevated surfaces with subtle warmth
  - Natural Border (oklch(0.88 0.01 85)) - Gentle, organic separations
- **Accent Color**: Deep Forest Green (oklch(0.45 0.12 160)) - Depth, grounded highlights, calm focus
- **Foreground/Background Pairings**:
  - Background (oklch(0.97 0.01 85)): Rich text (oklch(0.25 0.02 40)) - Ratio 14.8:1 ✓
  - Card (oklch(0.99 0.005 85)): Rich text (oklch(0.25 0.02 40)) - Ratio 15.6:1 ✓
  - Primary Green (oklch(0.65 0.18 155)): White text (oklch(1 0 0)) - Ratio 5.2:1 ✓
  - Accent Forest (oklch(0.45 0.12 160)): White text (oklch(1 0 0)) - Ratio 8.9:1 ✓

## Font Selection

Elegant, humanist typeface for UI that feels refined yet approachable, with monospace reserved for technical content only.

- **Typographic Hierarchy**:
  - H1 (App Title): Bricolage Grotesque SemiBold / 34px / tight - LogicWorkspace title, distinctive personality
  - H2 (Tool Names): Bricolage Grotesque Medium / 24px / tight - Panel headers, clear hierarchy
  - Body (Primary): Inter Regular / 15px / 1.6 line-height - Main content, exceptional readability
  - Label (UI Labels): Inter Medium / 14px / normal - Form labels, buttons, interface elements
  - Small (Metadata): Inter Regular / 13px / relaxed - File sizes, timestamps, secondary info
  - Mono (Technical): JetBrains Mono Regular / 14px / 1.6 line-height - Code only, minimal usage

## Animations

Smooth, purposeful animations that enhance unity and delight.

- **Tool card selection**: 300ms lift and shadow on hover, smooth scale and translate
- **Tool transitions**: 200ms fade when tool loads or when returning to start screen
- **Drag interactions**: Instant visual feedback on drag-over (no delay), smooth opacity changes
- **Code editor**: Live preview updates in real-time as you type (debounced 300ms)
- **File uploads**: 200ms fade-in as files appear in list
- **Button interactions**: 150ms color/shadow transitions on hover
- **Tab switching**: Smooth crossfade between editor tabs
- **Navigation**: Seamless fade transitions when moving between tools and start screen

## Component Selection

**Components**:
- Start Screen: Four large interactive cards with hover lift effects, generous padding (p-8), smooth shadows, instant tool launch
- Toolbar: Unified header showing current tool with back button, workspace logo, and connections access
- LogicPen: Side-by-side split panels with rounded borders, tab-based editor (HTML/CSS/JS), live iframe preview
- LogicDocs: Two-panel layout with LogicDocs sidebar (420px) and DocDump panel filling remaining space
- DocDump: Full-width single panel with drop zone, draggable folder/file cards, visual drop targets
- LogicCommons: Split-panel GitHub dashboard with repository sidebar (320px) and main content area with tabs for Overview (repo stats, languages, workflow runs), Files (file browser with branch selector, create/edit/delete), Issues, and Pull Requests. File browser shows directory tree with folder navigation, edit and delete actions on hover, and "New File" button.
- Connections Dialog: shadcn Dialog with tabbed form for adding connections
- File Editor Dialog: Modal editor for creating and editing files with path input, content textarea, commit message field, and save action

**Customizations**:
- Interactive tool cards with lift on hover
- Custom drag-and-drop with highlight states
- Split-panel layouts with proper spacing and borders
- Code editor textareas with mono font and subtle backgrounds
- Toolbar with tool identification (icon + name)
- Back button that maintains state

**States**:
- Tool cards: default, hover (lift + shadow), active (scale down briefly on click)
- Drag items: dragging (opacity 50%), drop target (ring + background accent)
- Buttons: default, hover, active, disabled
- Drop zone: default (dashed border), drag-over (solid border with glow)
- Editor tabs: inactive (muted), active (full color with underline)
- Toolbar: shows current tool context, back button always visible

**Icon Selection**:
- Workspace: Sparkle (logo)
- Tools: Code (LogicPen), FileDoc (LogicDocs), Stack (DocDump), GithubLogo (LogicCommons)
- Navigation: ArrowLeft (back to start, back to parent folder), ArrowSquareOut (external links)
- File operations: Plus (new file, create repo), UploadSimple, DownloadSimple, Trash (delete file), FolderPlus, FolderOpen, PencilSimple (edit file)
- Editor: Play (preview/run), Download (export)
- Connections: CloudArrowUp (main button), MicrosoftExcelLogo, GoogleLogo, GithubLogo
- GitHub operations: GitBranch (branches), GitPullRequest (PRs), GitCommit (commits), Circle (issue status), CheckCircle (closed/success), XCircle (failed/cancelled), User (authors), Clock (timestamps), Star (stars), GitFork (forks), Eye (watchers), Folder/File (file tree), Package (overview), Gauge (workflows), Spinner (in progress), FileJs/FileTs/FileHtml/FileCss/FileText/FileCode (file type icons)

**Spacing**:
- Start screen: Large cards with p-6, gap-6 grid
- Tool panels: p-4 outer padding, generous internal spacing
- Headers: h-16 for toolbar, h-14 for panel headers
- Cards: p-4 to p-6 depending on context
- Form elements: mb-4 to mb-6 for vertical rhythm

**Mobile**:
Single-column layout on mobile (<768px). Start screen stacks vertically. Tools take full screen. LogicDocs shows only one panel at a time with tab switcher. Toolbar becomes compact header. Touch targets minimum 44px. Drag-and-drop works on mobile with native touch events.
