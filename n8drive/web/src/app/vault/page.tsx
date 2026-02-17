"use client";

import { useState, useEffect } from "react";

type ProcessPackage = {
  id: string;
  version: string;
  title: string;
  description: string;
  formKeys: string[];
  manifest: {
    planHash: string;
    assets: Array<{ path: string; hash: string; mimeType: string }>;
  };
  mglCitations?: Array<{
    chapter: string;
    section: string;
    title: string;
    url?: string;
  }>;
  connectors?: string[];
  tenantScope: string | string[];
  createdBy: string;
  createdAt: string;
};

type DeployedProcess = {
  id: string;
  workspace_id: string;
  form_key: string;
  process_id: string;
  process_version: string;
  deployed_by: string;
  deployed_at: string;
  manifest_hash: string | null;
  status: "active" | "archived" | "error";
};

async function pjFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

export default function VaultPage() {
  const [processes, setProcesses] = useState<ProcessPackage[]>([]);
  const [deployedProcesses, setDeployedProcesses] = useState<DeployedProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProcess, setSelectedProcess] = useState<ProcessPackage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deployingKey, setDeployingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch available processes from Vault
  useEffect(() => {
    const fetchProcesses = async () => {
      try {
        // For now, mock data (will call VAULT_URL when available)
        const mockProcesses: ProcessPackage[] = [
          {
            id: "prr-intake",
            version: "1.0.0",
            title: "Public Records Request Intake",
            description: "Massachusetts public records request workflow with M.G.L. c.66 §10 compliance",
            formKeys: ["prr-intake-v1"],
            manifest: {
              planHash: "sha256:abc123...",
              assets: [],
            },
            mglCitations: [
              {
                chapter: "66",
                section: "10",
                title: "Public Records Law",
                url: "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleX/Chapter66/Section10",
              },
            ],
            connectors: ["email", "sharepoint"],
            tenantScope: "all",
            createdBy: "system",
            createdAt: new Date().toISOString(),
          },
          {
            id: "dog-license-renewal",
            version: "1.0.0",
            title: "Dog License Renewal",
            description: "Simple municipal dog licensing workflow with M.G.L. c.140 §137 compliance",
            formKeys: ["dog-license-renewal-v1"],
            manifest: {
              planHash: "sha256:def456...",
              assets: [],
            },
            mglCitations: [
              {
                chapter: "140",
                section: "137",
                title: "Dog Licensing Requirements",
                url: "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXX/Chapter140/Section137",
              },
            ],
            connectors: ["email"],
            tenantScope: "all",
            createdBy: "system",
            createdAt: new Date().toISOString(),
          },
          {
            id: "building-permit-intake",
            version: "1.0.0",
            title: "Building Permit Intake",
            description: "Multi-step building permit workflow with M.G.L. c.143 §3 compliance and approval chain",
            formKeys: ["building-permit-intake-v1"],
            manifest: {
              planHash: "sha256:ghi789...",
              assets: [],
            },
            mglCitations: [
              {
                chapter: "143",
                section: "3",
                title: "Building Permits",
                url: "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXX/Chapter143/Section3",
              },
            ],
            connectors: ["email", "sharepoint", "slack"],
            tenantScope: "all",
            createdBy: "system",
            createdAt: new Date().toISOString(),
          },
        ];
        setProcesses(mockProcesses);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load processes");
      }
    };

    const fetchDeployed = async () => {
      try {
        const deployed = await pjFetch("/api/vault/deployed-processes");
        setDeployedProcesses(deployed);
      } catch (err) {
        console.error("[vault] Failed to fetch deployed processes:", err);
        setDeployedProcesses([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProcesses();
    fetchDeployed();
  }, []);

  const handleDeploy = async (formKey: string) => {
    setDeployingKey(formKey);
    setError(null);
    try {
      const deployed = await pjFetch(`/api/vault/formkey/${formKey}/deploy`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setDeployedProcesses((prev) => [deployed, ...prev.filter((p) => p.form_key !== formKey)]);
      alert(`✅ Deployed ${formKey} successfully!`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deployment failed";
      setError(message);
      alert(`❌ ${message}`);
    } finally {
      setDeployingKey(null);
    }
  };

  const handleArchive = async (formKey: string) => {
    if (!confirm(`Archive ${formKey}? This will hide it from active deployments.`)) return;
    try {
      await pjFetch(`/api/vault/deployed-processes/${formKey}`, { method: "DELETE" });
      setDeployedProcesses((prev) => prev.filter((p) => p.form_key !== formKey));
      alert(`✅ Archived ${formKey}`);
    } catch (err) {
      alert(`❌ Failed to archive: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const filteredProcesses = processes.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.formKeys.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const isDeployed = (formKey: string) =>
    deployedProcesses.some((d) => d.form_key === formKey && d.status === "active");

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Vault: Process Catalog</h1>
        <p className="text-gray-600">Loading processes...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Vault: Process Catalog</h1>
        <p className="text-gray-600">
          Browse and deploy governed municipal processes from the Upstream Vault.
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search processes by title, description, or FormKey..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Process Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {filteredProcesses.map((process) => {
          const formKey = process.formKeys[0];
          const deployed = isDeployed(formKey);
          const deploying = deployingKey === formKey;

          return (
            <div
              key={process.id}
              className="border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedProcess(process)}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold">{process.title}</h3>
                {deployed && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                    Deployed
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-4 line-clamp-3">{process.description}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {process.formKeys.map((key) => (
                  <code key={key} className="px-2 py-1 bg-gray-100 text-xs rounded">
                    {key}
                  </code>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">v{process.version}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (deployed) {
                      handleArchive(formKey);
                    } else {
                      handleDeploy(formKey);
                    }
                  }}
                  disabled={deploying}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    deployed
                      ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  } disabled:opacity-50`}
                >
                  {deploying ? "Deploying..." : deployed ? "Archive" : "Deploy"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deployed Processes Section */}
      <div className="border-t pt-8">
        <h2 className="text-2xl font-bold mb-4">Deployed Processes</h2>
        {deployedProcesses.length === 0 ? (
          <p className="text-gray-600">No processes deployed yet. Deploy one from the catalog above!</p>
        ) : (
          <div className="space-y-4">
            {deployedProcesses
              .filter((d) => d.status === "active")
              .map((deployed) => {
                const process = processes.find((p) => p.formKeys.includes(deployed.form_key));
                return (
                  <div key={deployed.id} className="border rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{process?.title || deployed.form_key}</h4>
                      <p className="text-sm text-gray-600">
                        Deployed {new Date(deployed.deployed_at).toLocaleDateString()} • v
                        {deployed.process_version}
                      </p>
                    </div>
                    <button
                      onClick={() => handleArchive(deployed.form_key)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Archive
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Process Detail Modal */}
      {selectedProcess && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedProcess(null)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-2xl font-bold">{selectedProcess.title}</h2>
              <button
                onClick={() => setSelectedProcess(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <p className="text-gray-600 mb-4">{selectedProcess.description}</p>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">FormKeys</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedProcess.formKeys.map((key) => (
                    <code key={key} className="px-3 py-1 bg-gray-100 rounded">
                      {key}
                    </code>
                  ))}
                </div>
              </div>

              {selectedProcess.mglCitations && selectedProcess.mglCitations.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Legal Citations</h3>
                  <ul className="space-y-2">
                    {selectedProcess.mglCitations.map((citation, idx) => (
                      <li key={idx} className="text-sm">
                        <strong>
                          M.G.L. c.{citation.chapter} §{citation.section}
                        </strong>
                        : {citation.title}
                        {citation.url && (
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-600 hover:underline"
                          >
                            View statute →
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedProcess.connectors && selectedProcess.connectors.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Required Connectors</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedProcess.connectors.map((connector) => (
                      <span key={connector} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        {connector}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Metadata</h3>
                <dl className="text-sm space-y-1">
                  <div className="flex">
                    <dt className="font-medium w-32">Version:</dt>
                    <dd>{selectedProcess.version}</dd>
                  </div>
                  <div className="flex">
                    <dt className="font-medium w-32">Process ID:</dt>
                    <dd>{selectedProcess.id}</dd>
                  </div>
                  <div className="flex">
                    <dt className="font-medium w-32">Plan Hash:</dt>
                    <dd className="truncate">{selectedProcess.manifest.planHash}</dd>
                  </div>
                  <div className="flex">
                    <dt className="font-medium w-32">Created:</dt>
                    <dd>{new Date(selectedProcess.createdAt).toLocaleDateString()}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  handleDeploy(selectedProcess.formKeys[0]);
                  setSelectedProcess(null);
                }}
                disabled={
                  isDeployed(selectedProcess.formKeys[0]) ||
                  deployingKey === selectedProcess.formKeys[0]
                }
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isDeployed(selectedProcess.formKeys[0])
                  ? "Already Deployed"
                  : deployingKey === selectedProcess.formKeys[0]
                  ? "Deploying..."
                  : "Deploy to Workspace"}
              </button>
              <button
                onClick={() => setSelectedProcess(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
