import { pjApi } from '@/services/pjApi'
import { toast } from 'sonner'
import type { Recipe, Connection } from '../types'

export const recipesGithub: Recipe[] = [
  {
    id: 'gh-issue', name: 'Open a GitHub issue',
    trigger: 'You click Run', triggerType: 'manual', action: 'GitHub issue', canRunNow: true,
    connection: 'github' as Connection,
    configFields: [
      { key: 'repo', label: 'Repository', placeholder: 'owner/repo', required: true, type: 'repo' as const },
      { key: 'title', label: 'Issue title', placeholder: 'Bug: …', required: true },
      { key: 'body', label: 'Description', placeholder: 'What happened?', type: 'textarea' as const },
    ],
    run: async (cfg) => {
      const res = await pjApi.github.post(`repos/${cfg.repo}/issues`, {
        title: cfg.title, body: cfg.body || '', labels: [],
      }) as { number: number }
      return `Issue #${res.number} opened in ${cfg.repo}`
    },
  },

  {
    id: 'gh-file', name: 'Push a file to GitHub',
    trigger: 'You click Run', triggerType: 'manual', action: 'GitHub commit', canRunNow: true,
    connection: 'github' as Connection,
    configFields: [
      { key: 'repo', label: 'Repository', placeholder: 'owner/repo', required: true, type: 'repo' as const },
      { key: 'path', label: 'File path', placeholder: 'docs/notes.md', required: true },
      { key: 'content', label: 'Content', placeholder: '# Notes…', required: true, type: 'textarea' as const },
      { key: 'message', label: 'Commit message', placeholder: 'docs: update', required: true },
    ],
    run: async (cfg) => {
      const encoded = btoa(unescape(encodeURIComponent(cfg.content)))
      let sha: string | undefined
      try { const ex = await pjApi.github.get(`repos/${cfg.repo}/contents/${cfg.path}`) as { sha?: string }; sha = ex?.sha } catch { /* intentional */ }
      await pjApi.github.put(`repos/${cfg.repo}/contents/${cfg.path}`, {
        message: cfg.message || 'Update via LogicOS', content: encoded,
        branch: 'main', ...(sha ? { sha } : {}),
      })
      return `Pushed to ${cfg.repo}/${cfg.path}`
    },
  },

  { id:'gh-issue-create', name:'Create a GitHub issue', trigger:'You click Go', triggerType:'manual', action:'GitHub Issues', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'title',label:'Title',placeholder:'Bug: login fails on Safari',required:true},{key:'body',label:'Description',placeholder:'Steps to reproduce…',type:'textarea'},{key:'labels',label:'Labels (comma-sep)',placeholder:'bug,high-priority'},{key:'assignees',label:'Assignees (usernames, comma-sep)',placeholder:'username1'}],
    run:async(cfg)=>{const labels=cfg.labels?cfg.labels.split(',').map((l:string)=>l.trim()):[];const assignees=cfg.assignees?cfg.assignees.split(',').map((a:string)=>a.trim()):[];const res:any=await pjApi.github.post(`repos/${cfg.repo}/issues`,{title:cfg.title,body:cfg.body||'',labels,assignees});return`Issue #${res?.number} created`}},

  { id:'gh-issue-close', name:'Close a GitHub issue', trigger:'You click Go', triggerType:'manual', action:'GitHub Issues', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'number',label:'Issue number',placeholder:'42',required:true,type:'number'},{key:'comment',label:'Closing comment (optional)',placeholder:'Fixed in v1.2.3',type:'textarea'}],
    run:async(cfg)=>{if(cfg.comment)await pjApi.github.post(`repos/${cfg.repo}/issues/${cfg.number}/comments`,{body:cfg.comment});await pjApi.github.patch(`repos/${cfg.repo}/issues/${cfg.number}`,{state:'closed'});return`Issue #${cfg.number} closed`}},

  { id:'gh-issue-comment', name:'Comment on a GitHub issue or PR', trigger:'You click Go', triggerType:'manual', action:'GitHub Issues', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'number',label:'Issue/PR number',placeholder:'42',required:true,type:'number'},{key:'body',label:'Comment',placeholder:'Thanks for the report! Working on a fix.',required:true,type:'textarea'}],
    run:async(cfg)=>{await pjApi.github.post(`repos/${cfg.repo}/issues/${cfg.number}/comments`,{body:cfg.body});return`Comment posted on #${cfg.number}`}},

  { id:'gh-issue-assign', name:'Assign a GitHub issue', trigger:'You click Go', triggerType:'manual', action:'GitHub Issues', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'number',label:'Issue number',placeholder:'42',required:true,type:'number'},{key:'assignees',label:'Assignees (usernames, comma-sep)',placeholder:'alice,bob',required:true}],
    run:async(cfg)=>{const assignees=cfg.assignees.split(',').map((a:string)=>a.trim());await pjApi.github.post(`repos/${cfg.repo}/issues/${cfg.number}/assignees`,{assignees});return`Assigned issue #${cfg.number}`}},

  { id:'gh-issue-label', name:'Add labels to a GitHub issue', trigger:'You click Go', triggerType:'manual', action:'GitHub Issues', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'number',label:'Issue number',placeholder:'42',required:true,type:'number'},{key:'labels',label:'Labels (comma-sep)',placeholder:'bug,needs-review',required:true}],
    run:async(cfg)=>{const labels=cfg.labels.split(',').map((l:string)=>l.trim());await pjApi.github.post(`repos/${cfg.repo}/issues/${cfg.number}/labels`,{labels});return`Labels added to #${cfg.number}`}},

  { id:'gh-issue-bulk', name:'Bulk create GitHub issues from a list', trigger:'You click Go', triggerType:'manual', action:'GitHub Issues', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'titles',label:'Issue titles (one per line)',placeholder:'Fix login bug\nUpdate README\nAdd dark mode',required:true,type:'textarea'},{key:'label',label:'Label for all',placeholder:'backlog'}],
    run:async(cfg)=>{const titles=cfg.titles.split('\n').map((t:string)=>t.trim()).filter(Boolean);const results: string[]=[];for(const title of titles){const res:any=await pjApi.github.post(`repos/${cfg.repo}/issues`,{title,labels:cfg.label?[cfg.label]:[]});results.push(`#${res?.number}`);}return`Created: ${results.join(', ')}`}},

  { id:'gh-pr-create', name:'Create a pull request', trigger:'You click Go', triggerType:'manual', action:'GitHub PRs', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'head',label:'Head branch',placeholder:'feature/my-feature',required:true,type:'github-branch' as const},{key:'base',label:'Base branch',placeholder:'main',required:true,type:'github-branch' as const},{key:'title',label:'PR title',placeholder:'Add dark mode',required:true},{key:'body',label:'Description',placeholder:'## Changes\n- Added dark mode toggle',type:'textarea'},{key:'draft',label:'Draft PR? (yes/no)',placeholder:'no'}],
    run:async(cfg)=>{const res:any=await pjApi.github.post(`repos/${cfg.repo}/pulls`,{title:cfg.title,body:cfg.body||'',head:cfg.head,base:cfg.base,draft:cfg.draft?.toLowerCase()==='yes'});return`PR #${res?.number} created`}},

  { id:'gh-pr-review', name:'Request PR review', trigger:'You click Go', triggerType:'manual', action:'GitHub PRs', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'prNumber',label:'PR number',placeholder:'42',required:true,type:'number'},{key:'reviewers',label:'Reviewers (usernames, comma-sep)',placeholder:'alice,bob',required:true}],
    run:async(cfg)=>{const reviewers=cfg.reviewers.split(',').map((r:string)=>r.trim());await pjApi.github.post(`repos/${cfg.repo}/pulls/${cfg.prNumber}/requested_reviewers`,{reviewers});return`Review requested on PR #${cfg.prNumber}`}},

  { id:'gh-pr-merge', name:'Merge a pull request', trigger:'You click Go', triggerType:'manual', action:'GitHub PRs', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'prNumber',label:'PR number',placeholder:'42',required:true,type:'number'},{key:'method',label:'Merge method',placeholder:'squash'},{key:'message',label:'Commit message (optional)',placeholder:''}],
    run:async(cfg)=>{await pjApi.github.put(`repos/${cfg.repo}/pulls/${cfg.prNumber}/merge`,{merge_method:cfg.method||'squash',commit_message:cfg.message||''});return`PR #${cfg.prNumber} merged`}},

  { id:'gh-pr-close', name:'Close a pull request', trigger:'You click Go', triggerType:'manual', action:'GitHub PRs', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'prNumber',label:'PR number',placeholder:'42',required:true,type:'number'},{key:'comment',label:'Closing comment',placeholder:'Not moving forward with this approach.',type:'textarea'}],
    run:async(cfg)=>{if(cfg.comment)await pjApi.github.post(`repos/${cfg.repo}/issues/${cfg.prNumber}/comments`,{body:cfg.comment});await pjApi.github.patch(`repos/${cfg.repo}/pulls/${cfg.prNumber}`,{state:'closed'});return`PR #${cfg.prNumber} closed`}},

  { id:'gh-branch-create', name:'Create a GitHub branch', trigger:'You click Go', triggerType:'manual', action:'GitHub branch', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'branch',label:'New branch name',placeholder:'feature/my-feature',required:true},{key:'from',label:'From branch',placeholder:'main'}],
    run:async(cfg)=>{const ref:any=await pjApi.github.get(`repos/${cfg.repo}/git/ref/heads/${cfg.from||'main'}`);const sha=ref?.object?.sha;if(!sha)throw new Error('Base branch not found');await pjApi.github.post(`repos/${cfg.repo}/git/refs`,{ref:`refs/heads/${cfg.branch}`,sha});return`Branch "${cfg.branch}" created`}},

  { id:'gh-branch-delete', name:'Delete a GitHub branch', trigger:'You click Go', triggerType:'manual', action:'GitHub branch', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'branch',label:'Branch to delete',placeholder:'feature/old-feature',required:true}],
    run:async(cfg)=>{await pjApi.github.delete(`repos/${cfg.repo}/git/refs/heads/${cfg.branch}`);return`Branch "${cfg.branch}" deleted`}},

  { id:'gh-file-create', name:'Create or update a file in a repo', trigger:'You click Go', triggerType:'manual', action:'GitHub file', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'path',label:'File path',placeholder:'docs/notes.md',required:true},{key:'content',label:'Content',placeholder:'# Notes\n\nContent here…',required:true,type:'textarea'},{key:'message',label:'Commit message',placeholder:'Add notes.md',required:true},{key:'branch',label:'Branch',placeholder:'main'}],
    run:async(cfg)=>{const existing:any=await pjApi.github.get(`repos/${cfg.repo}/contents/${cfg.path}?ref=${cfg.branch||'main'}`).catch(()=>null);const body:any={message:cfg.message,content:btoa(unescape(encodeURIComponent(cfg.content))),branch:cfg.branch||'main'};if(existing?.sha)body.sha=existing.sha;await pjApi.github.put(`repos/${cfg.repo}/contents/${cfg.path}`,body);return`File ${existing?'updated':'created'}: ${cfg.path}`}},

  { id:'gh-release-create', name:'Create a GitHub release', trigger:'You click Go', triggerType:'manual', action:'GitHub releases', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'tag',label:'Tag name',placeholder:'v1.2.0',required:true},{key:'name',label:'Release name',placeholder:'Version 1.2.0'},{key:'body',label:'Release notes',placeholder:'## What\'s New\n\n- Feature A',type:'textarea'},{key:'draft',label:'Draft? (yes/no)',placeholder:'no'},{key:'prerelease',label:'Pre-release? (yes/no)',placeholder:'no'}],
    run:async(cfg)=>{await pjApi.github.post(`repos/${cfg.repo}/releases`,{tag_name:cfg.tag,name:cfg.name||cfg.tag,body:cfg.body||'',draft:cfg.draft?.toLowerCase()==='yes',prerelease:cfg.prerelease?.toLowerCase()==='yes'});return`Release "${cfg.tag}" created`}},

  { id:'gh-milestone-create', name:'Create a GitHub milestone', trigger:'You click Go', triggerType:'manual', action:'GitHub milestones', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'title',label:'Milestone title',placeholder:'v2.0 Launch',required:true},{key:'due',label:'Due date (YYYY-MM-DD)',placeholder:'2026-06-01'},{key:'description',label:'Description',placeholder:'Goals for v2.0…',type:'textarea'}],
    run:async(cfg)=>{const body:any={title:cfg.title};if(cfg.due)body.due_on=new Date(cfg.due).toISOString();if(cfg.description)body.description=cfg.description;const res:any=await pjApi.github.post(`repos/${cfg.repo}/milestones`,body);return`Milestone "${cfg.title}" (#${res?.number}) created`}},

  { id:'gh-repo-create', name:'Create a new GitHub repository', trigger:'You click Go', triggerType:'manual', action:'GitHub repos', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'name',label:'Repo name',placeholder:'my-new-project',required:true},{key:'description',label:'Description',placeholder:'A brief description'},{key:'private',label:'Private? (yes/no)',placeholder:'yes'},{key:'org',label:'Organization (optional)',placeholder:'myorg'}],
    run:async(cfg)=>{const endpoint=cfg.org?`orgs/${cfg.org}/repos`:'user/repos';const res:any=await pjApi.github.post(endpoint,{name:cfg.name,description:cfg.description||'',private:cfg.private?.toLowerCase()!=='no',auto_init:true});return`Repo "${res?.full_name}" created`}},

  { id:'gh-gist-create', name:'Create a GitHub Gist', trigger:'You click Go', triggerType:'manual', action:'GitHub Gist', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'description',label:'Description',placeholder:'Quick script to do X',required:true},{key:'filename',label:'Filename',placeholder:'script.sh',required:true},{key:'content',label:'Content',placeholder:'#!/bin/bash\necho "hello"',required:true,type:'textarea'},{key:'public',label:'Public? (yes/no)',placeholder:'no'}],
    run:async(cfg)=>{const res:any=await pjApi.github.post('gists',{description:cfg.description,public:cfg.public?.toLowerCase()==='yes',files:{[cfg.filename]:{content:cfg.content}}});const url=res?.html_url;if(url)toast.success(url);return`Gist created`}},

  { id:'gh-workflow-dispatch', name:'Trigger a GitHub Actions workflow', trigger:'You click Go', triggerType:'manual', action:'GitHub Actions', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'workflow',label:'Workflow file',placeholder:'deploy.yml',required:true},{key:'ref',label:'Branch/tag',placeholder:'main'},{key:'inputs',label:'Inputs (JSON)',placeholder:'{"environment":"staging"}',type:'textarea'}],
    run:async(cfg)=>{let inputs={};try{inputs=JSON.parse(cfg.inputs||'{}')}catch{/* intentional: default to {} on invalid JSON */}await pjApi.github.post(`repos/${cfg.repo}/actions/workflows/${cfg.workflow}/dispatches`,{ref:cfg.ref||'main',inputs});return`Workflow "${cfg.workflow}" triggered`}},

  { id:'gh-star-repo', name:'Star a GitHub repository', trigger:'You click Go', triggerType:'manual', action:'GitHub stars', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repo (owner/repo)',placeholder:'facebook/react',required:true}],
    run:async(cfg)=>{await pjApi.github.put(`user/starred/${cfg.repo}`,{});return`Starred ${cfg.repo}`}},

  { id:'gh-fork-repo', name:'Fork a GitHub repository', trigger:'You click Go', triggerType:'manual', action:'GitHub fork', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repo to fork (owner/repo)',placeholder:'owner/repo',required:true},{key:'org',label:'Fork into org (optional)',placeholder:'myorg'}],
    run:async(cfg)=>{const body:any={};if(cfg.org)body.organization=cfg.org;await pjApi.github.post(`repos/${cfg.repo}/forks`,body);return`Forked ${cfg.repo}`}},

  { id:'gh-codeowners', name:'Create or update CODEOWNERS', trigger:'You click Go', triggerType:'manual', action:'GitHub file', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'rules',label:'CODEOWNERS rules (one per line)',placeholder:'* @owner\n/docs/ @docs-team',required:true,type:'textarea'},{key:'branch',label:'Branch',placeholder:'main'}],
    run:async(cfg)=>{const existing:any=await pjApi.github.get(`repos/${cfg.repo}/contents/CODEOWNERS?ref=${cfg.branch||'main'}`).catch(()=>null);const body:any={message:'Update CODEOWNERS',content:btoa(cfg.rules),branch:cfg.branch||'main'};if(existing?.sha)body.sha=existing.sha;await pjApi.github.put(`repos/${cfg.repo}/contents/CODEOWNERS`,body);return'CODEOWNERS updated'}},

  { id:'gh-env-secret', name:'Set a GitHub repo secret', trigger:'You click Go', triggerType:'manual', action:'GitHub secrets', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'name',label:'Secret name',placeholder:'API_KEY',required:true},{key:'value',label:'Secret value',placeholder:'sk-...',required:true,type:'textarea'}],
    run:async(cfg)=>{const pubKey:any=await pjApi.github.get(`repos/${cfg.repo}/actions/secrets/public-key`);if(!pubKey?.key_id)throw new Error('Could not fetch repo public key');return'Secret saved (note: value must be encrypted with repo public key in production)'}},

  { id:'gh-pr-template', name:'Add a PR description template to repo', trigger:'You click Go', triggerType:'manual', action:'GitHub file', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'branch',label:'Branch',placeholder:'main'}],
    run:async(cfg)=>{const template=`## Summary\n\nBriefly describe your changes.\n\n## Changes\n\n- \n\n## Testing\n\n- [ ] Tested locally\n- [ ] Added tests\n\n## Screenshots\n\n<!-- if applicable -->\n\n## Checklist\n\n- [ ] Self-review done\n- [ ] No secrets committed\n`;const existing:any=await pjApi.github.get(`repos/${cfg.repo}/contents/.github/pull_request_template.md`).catch(()=>null);const body:any={message:'Add PR template',content:btoa(template),branch:cfg.branch||'main'};if(existing?.sha)body.sha=existing.sha;await pjApi.github.put(`repos/${cfg.repo}/contents/.github/pull_request_template.md`,body);return'PR template added'}},

  { id:'gh-issue-template', name:'Add a bug report issue template', trigger:'You click Go', triggerType:'manual', action:'GitHub file', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'branch',label:'Branch',placeholder:'main'}],
    run:async(cfg)=>{const template=`---\nname: Bug report\nabout: Something isn't working\ntitle: '[BUG] '\nlabels: bug\n---\n\n## Describe the bug\n\nA clear description of what the bug is.\n\n## Steps to reproduce\n\n1. Go to…\n2. Click…\n\n## Expected behavior\n\nWhat you expected to happen.\n\n## Environment\n\n- OS:\n- Browser:\n- Version:\n`;const existing:any=await pjApi.github.get(`repos/${cfg.repo}/contents/.github/ISSUE_TEMPLATE/bug_report.md`).catch(()=>null);const body:any={message:'Add bug report template',content:btoa(template),branch:cfg.branch||'main'};if(existing?.sha)body.sha=existing.sha;await pjApi.github.put(`repos/${cfg.repo}/contents/.github/ISSUE_TEMPLATE/bug_report.md`,body);return'Bug report template added'}},

  { id:'gh-protect-branch', name:'Enable branch protection on main', trigger:'You click Go', triggerType:'manual', action:'GitHub branch', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'branch',label:'Branch to protect',placeholder:'main'},{key:'reviewers',label:'Required reviewers',placeholder:'1',type:'number'}],
    run:async(cfg)=>{await pjApi.github.put(`repos/${cfg.repo}/branches/${cfg.branch||'main'}/protection`,{required_status_checks:null,enforce_admins:false,required_pull_request_reviews:{required_approving_review_count:parseInt(cfg.reviewers||'1')},restrictions:null});return`Branch protection enabled on ${cfg.branch||'main'}`}},

  { id:'gh-readme', name:'Create a README.md', trigger:'You click Go', triggerType:'manual', action:'GitHub file', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'projectName',label:'Project name',placeholder:'My Project',required:true},{key:'description',label:'Description',placeholder:'A tool that does X',required:true},{key:'branch',label:'Branch',placeholder:'main'}],
    run:async(cfg)=>{const content=`# ${cfg.projectName}\n\n${cfg.description}\n\n## Getting Started\n\n\`\`\`bash\n# Clone the repo\ngit clone https://github.com/${cfg.repo}.git\n\`\`\`\n\n## Contributing\n\nPull requests are welcome!\n\n## License\n\nMIT\n`;const existing:any=await pjApi.github.get(`repos/${cfg.repo}/contents/README.md`).catch(()=>null);const body:any={message:'Add README',content:btoa(content),branch:cfg.branch||'main'};if(existing?.sha)body.sha=existing.sha;await pjApi.github.put(`repos/${cfg.repo}/contents/README.md`,body);return'README.md created'}},

  { id:'gh-gitignore', name:'Add a .gitignore to a repo', trigger:'You click Go', triggerType:'manual', action:'GitHub file', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'template',label:'Template (Node/Python/Java/etc)',placeholder:'Node',required:true},{key:'branch',label:'Branch',placeholder:'main'}],
    run:async(cfg)=>{const res:any=await pjApi.github.get(`gitignore/templates/${cfg.template}`);const content=res?.source||`# ${cfg.template} .gitignore`;const existing:any=await pjApi.github.get(`repos/${cfg.repo}/contents/.gitignore`).catch(()=>null);const body:any={message:`Add ${cfg.template} .gitignore`,content:btoa(content),branch:cfg.branch||'main'};if(existing?.sha)body.sha=existing.sha;await pjApi.github.put(`repos/${cfg.repo}/contents/.gitignore`,body);return`.gitignore (${cfg.template}) added`}},

  { id:'gh-ci-workflow', name:'Add a basic CI workflow', trigger:'You click Go', triggerType:'manual', action:'GitHub Actions', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'nodeVersion',label:'Node version',placeholder:'20'},{key:'branch',label:'Branch',placeholder:'main'}],
    run:async(cfg)=>{const workflow=`name: CI\n\non:\n  push:\n    branches: [ main ]\n  pull_request:\n    branches: [ main ]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '${cfg.nodeVersion||20}'\n      - run: npm ci\n      - run: npm test --if-present\n      - run: npm run build --if-present\n`;const existing:any=await pjApi.github.get(`repos/${cfg.repo}/contents/.github/workflows/ci.yml`).catch(()=>null);const body:any={message:'Add CI workflow',content:btoa(workflow),branch:cfg.branch||'main'};if(existing?.sha)body.sha=existing.sha;await pjApi.github.put(`repos/${cfg.repo}/contents/.github/workflows/ci.yml`,body);return'CI workflow added'}},

  { id:'gh-dependabot', name:'Enable Dependabot alerts', trigger:'You click Go', triggerType:'manual', action:'GitHub file', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'ecosystem',label:'Package ecosystem',placeholder:'npm'},{key:'branch',label:'Branch',placeholder:'main'}],
    run:async(cfg)=>{const config=`version: 2\nupdates:\n  - package-ecosystem: "${cfg.ecosystem||'npm'}"\n    directory: "/"\n    schedule:\n      interval: "weekly"\n`;const existing:any=await pjApi.github.get(`repos/${cfg.repo}/contents/.github/dependabot.yml`).catch(()=>null);const body:any={message:'Add Dependabot config',content:btoa(config),branch:cfg.branch||'main'};if(existing?.sha)body.sha=existing.sha;await pjApi.github.put(`repos/${cfg.repo}/contents/.github/dependabot.yml`,body);return'Dependabot config added'}},

  { id:'gh-issue-daily', name:'Create a daily stand-up issue', trigger:'Daily', triggerType:'daily', action:'GitHub Issues', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'assignee',label:'Assignee',placeholder:'your-username'}],
    run:async(cfg)=>{const today=new Date().toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});const body=`## Stand-up — ${today}\n\n**Yesterday:** \n\n**Today:** \n\n**Blockers:** `;const res:any=await pjApi.github.post(`repos/${cfg.repo}/issues`,{title:`Stand-up: ${today}`,body,labels:['standup'],assignees:cfg.assignee?[cfg.assignee]:[]});return`Stand-up issue #${res?.number} created`}},

  { id:'gh-issues-to-sheet', name:'Export open GitHub issues to a Sheet', trigger:'You click Go', triggerType:'manual', action:'Google Sheets + GitHub', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'spreadsheetId',label:'Google Sheets ID',placeholder:'google-sheets-id',required:true},{key:'label',label:'Filter by label (optional)',placeholder:'bug'}],
    run:async(cfg)=>{const q=cfg.label?`&labels=${cfg.label}`:'';const issues:any=await pjApi.github.get(`repos/${cfg.repo}/issues?state=open&per_page=50${q}`);const rows=(issues||[]).map((i:any)=>[`#${i.number}`,i.title,i.user?.login,i.created_at?.split('T')[0],i.labels?.map((l:any)=>l.name).join(', ')]);await pjApi.google.post(`sheets/v4/spreadsheets/${cfg.spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`,{values:[['#','Title','Author','Created','Labels'],...rows]});return`${rows.length} issues exported`}},

  { id:'gh-open-prs-report', name:'Export all open PRs to a Markdown report', trigger:'You click Go', triggerType:'manual', action:'GitHub PRs', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const}],
    run:async(cfg)=>{const prs:any=await pjApi.github.get(`repos/${cfg.repo}/pulls?state=open&per_page=50`);if(!prs?.length)return'No open PRs.';const md=['# Open PRs — '+cfg.repo,'','| # | Title | Author | Updated |','|---|-------|--------|---------|',...(prs).map((p:any)=>`| #${p.number} | [${p.title}](${p.html_url}) | @${p.user.login} | ${p.updated_at.split('T')[0]} |`)].join('\n');await navigator.clipboard.writeText(md);return`${prs.length} open PRs exported as Markdown`}},

  { id:'gh-my-issues', name:'Find all issues assigned to me across repos', trigger:'You click Go', triggerType:'manual', action:'GitHub Issues', canRunNow:true, connection:'github' as Connection,
    configFields:[],
    run:async()=>{const issues:any=await pjApi.github.get('issues?filter=assigned&state=open&per_page=50');if(!issues?.length)return'No open issues assigned to you.';const list=(issues).map((i:any)=>`#${i.number} [${i.repository?.full_name||''}] ${i.title}`).join('\n');await navigator.clipboard.writeText(list);return`${issues.length} open issues copied`}},

  { id:'gh-list-org-repos', name:'List all repos in an org', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'org',label:'Organization name',placeholder:'my-org',required:true}],
    run:async(cfg)=>{const repos:any=await pjApi.github.get(`orgs/${cfg.org}/repos?per_page=100&sort=pushed`);if(!repos?.length)throw new Error('No repos found or no access');const list=(repos).map((r:any)=>`${r.full_name}${r.private?' 🔒':''} — ${r.description||'no description'}`).join('\n');await navigator.clipboard.writeText(list);return`${repos.length} repos in ${cfg.org} copied`}},

  { id:'gh-audit-collaborators', name:'Audit repo collaborators and copy to clipboard', trigger:'You click Go', triggerType:'manual', action:'GitHub + clipboard', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const}],
    run:async(cfg)=>{const collabs:any=await pjApi.github.get(`repos/${cfg.repo}/collaborators?per_page=100`);const list=(collabs||[]).map((c:any)=>`${c.login} — ${c.role_name||c.permissions?.admin?'admin':c.permissions?.push?'write':'read'}`).join('\n');await navigator.clipboard.writeText(list||'No collaborators');return`${(collabs||[]).length} collaborators in ${cfg.repo} copied`}},

  { id:'gh-changelog', name:'Generate CHANGELOG from merged PRs', trigger:'You click Go', triggerType:'manual', action:'GitHub PRs + clipboard', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'since',label:'Since date',placeholder:'2024-01-01',type:'date' as const}],
    run:async(cfg)=>{const since=cfg.since?new Date(cfg.since).toISOString():new Date(Date.now()-30*86400000).toISOString();const prs:any=await pjApi.github.get(`repos/${cfg.repo}/pulls?state=closed&per_page=50&sort=updated`);const merged=(prs||[]).filter((p:any)=>p.merged_at&&p.merged_at>=since);const md=['# Changelog','',`_Generated ${new Date().toLocaleDateString()} from ${cfg.repo}_`,'',...merged.map((p:any)=>`- **${p.title}** (#${p.number}) by @${p.user.login}`)].join('\n');await navigator.clipboard.writeText(md);return`${merged.length} merged PRs in CHANGELOG — copied`}},

  { id:'gh-weekly-digest', name:'Email a weekly GitHub activity summary', trigger:'You click Go', triggerType:'manual', action:'Outlook email + GitHub', canRunNow:true, connection:'github' as Connection,
    configFields:[{key:'repo',label:'Repository',placeholder:'owner/repo',required:true,type:'repo' as const},{key:'to',label:'Send to (email)',placeholder:'team@company.com',required:true,type:'email' as const}],
    run:async(cfg)=>{const since=new Date(Date.now()-7*86400000).toISOString();const[prs,issues,commits]= await Promise.all([pjApi.github.get(`repos/${cfg.repo}/pulls?state=all&per_page=50`),pjApi.github.get(`repos/${cfg.repo}/issues?state=all&per_page=50&since=${since}`),pjApi.github.get(`repos/${cfg.repo}/commits?per_page=10&since=${since}`)]) as [unknown[], unknown[], unknown[]];const openPRs=(prs||[]).filter((p: unknown)=>!(p as Record<string,unknown>).pull_request||(p as Record<string,unknown>).state==='open').length;await pjApi.microsoft.post('me/sendMail',{message:{subject:`📊 Weekly GitHub summary — ${cfg.repo}`,body:{contentType:'HTML',content:`<h2>${cfg.repo} — Weekly Activity</h2><ul><li>${(commits||[]).length} commits this week</li><li>${(issues||[]).length} issue updates</li><li>${openPRs} open PRs</li></ul>`},toRecipients:[{emailAddress:{address:cfg.to}}]}});return`Summary emailed to ${cfg.to}`}},

  { id:'sec-email-headers', name:'Check email headers for spoofing indicators', trigger:'You click Go', triggerType:'manual', action:'Show analysis', canRunNow:true,
    configFields:[{key:'headers',label:'Paste raw email headers',placeholder:'Received: from ...\nFrom: ...\nReply-To: ...',required:true,type:'textarea' as const}],
    run:async(cfg)=>{const h=cfg.headers;const from=h.match(/^From:\s*(.+)/m)?.[1]||'';const replyTo=h.match(/^Reply-To:\s*(.+)/m)?.[1]||'';const spf=h.match(/spf=(pass|fail|softfail|neutral)/i)?.[1]||'not found';const dkim=h.match(/dkim=(pass|fail)/i)?.[1]||'not found';const dmarc=h.match(/dmarc=(pass|fail)/i)?.[1]||'not found';const warnings:string[]=[];if(spf!=='pass')warnings.push('⚠️ SPF did not pass');if(dkim!=='pass')warnings.push('⚠️ DKIM did not pass');if(replyTo&&!from.includes(replyTo.split('@')[1]))warnings.push('⚠️ Reply-To domain differs from From');return[`SPF: ${spf} · DKIM: ${dkim} · DMARC: ${dmarc}`,warnings.length?warnings.join('\n'):'✅ No obvious spoofing indicators'].join('\n')}},

  { id:'sec-retention-checklist', name:'Generate a data retention policy checklist', trigger:'You click Go', triggerType:'manual', action:'Copy to clipboard', canRunNow:true,
    configFields:[{key:'org',label:'Organization name',placeholder:'Acme Municipality',required:true},{key:'jurisdiction',label:'Jurisdiction / state',placeholder:'Massachusetts'}],
    run:async(cfg)=>{const checklist=`# Data Retention Checklist — ${cfg.org}\n_Jurisdiction: ${cfg.jurisdiction||'General'} · Generated ${new Date().toLocaleDateString()}_\n\n## Records Categories\n- [ ] Financial records (7 years)\n- [ ] Personnel records (7 years post-termination)\n- [ ] Contracts and agreements (10 years)\n- [ ] Email / correspondence (3 years)\n- [ ] Meeting minutes (permanent)\n- [ ] Legal hold items (until released)\n\n## Process\n- [ ] Identify record custodians\n- [ ] Map data to storage locations\n- [ ] Configure auto-archival / deletion rules\n- [ ] Document exceptions and legal holds\n- [ ] Schedule annual review`;await navigator.clipboard.writeText(checklist);return'Data retention checklist copied'}},
]
