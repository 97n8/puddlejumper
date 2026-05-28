# LogicOS + PuddleJumper Architecture Map

```mermaid
flowchart TD
  subgraph Lock["Architecture lock boundaries"]
    LockA["No @vercel/kv"]
    LockB["No Postgres"]
    LockC["No Redis"]
    LockD["No n8n"]
  end

  subgraph Shared["Shared substrate"]
    SQLite["SQLite + better-sqlite3 + WAL"]
  end

  subgraph LogicOS["LogicOS repo"]
    subgraph Spine["LogicOS spine"]
      Records["logicos_records"]
      Audit["audit_events<br/>append-only"]
      Seq["id_sequence"]
      Routing["logicos_routing"]
    end

    subgraph Modules["LogicOS modules"]
      Logicos["logicos"]
      Commons["logiccommons"]
      Builder["builder"]
      Flows["flows"]
      Civic["civic"]
    end
  end

  subgraph PJ["PuddleJumper repo"]
    subgraph API["PuddleJumper API layer"]
      Server["server.ts"]
      PRR["prrStore"]
      CivicStore["civicStore"]
      CivicRoutes["civicRoutes"]
    end

    subgraph CivicInt["PuddleJumper civic integration"]
      FlowStore["flowStore"]
      FrameworkRegistry["frameworkRegistry"]
      Synchron8["synchron8"]
      MCP["mcp.ts"]
    end

    Auth["PJ auth / civic_actors source"]
  end

  Modules --> Spine
  Logicos --> Records
  Commons --> Records
  Builder --> Routing
  Flows --> Routing
  Civic --> Audit

  Server --> PRR
  Server --> CivicStore
  Server --> CivicRoutes
  CivicRoutes --> FlowStore
  CivicRoutes --> FrameworkRegistry
  CivicRoutes --> Synchron8
  Server --> MCP

  Spine --> SQLite
  API --> SQLite
  CivicInt --> SQLite

  Auth -->|civic_actors FK| Records
  Auth -->|actor identity| Audit

  Lock --> LogicOS
  Lock --> PJ
```

- **Substrate:** both repos run on SQLite with `better-sqlite3` and WAL, not a hosted KV or external queue/database substrate.
- **Append-only audit:** `audit_events` is treated as immutable history, with no-update and no-delete triggers enforcing append-only behavior.
- **Runtime routing:** `logicos_routing` and the civic framework registry decide where work goes at runtime instead of hard-coding destinations into UI state.
- **AI assist, not decide:** scenario and workflow tooling can draft, classify, and suggest, but human review gates remain explicit in the flow graph and operator workflow.
- **Municipal data ownership:** records, routing state, and civic actor references stay in municipal-controlled application storage; integrations move data under operator-visible rules rather than taking ownership away.
