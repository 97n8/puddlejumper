import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { ProcessPackage, VaultManifest } from "./schema.js";
import { ProcessPackageSchema } from "./schema.js";
import type { VaultStorage } from "./storage.js";

/**
 * FileSystemVaultStorage
 * 
 * Stores process packages as JSON files in a directory structure:
 * 
 * data/
 *   processes/
 *     prr-intake-v1.json
 *     dog-license-renewal-v1.json
 *     building-permit-intake-v1.json
 */
export class FileSystemVaultStorage implements VaultStorage {
  private readonly processesDir: string;
  private cache: Map<string, ProcessPackage> = new Map();
  private formKeyIndex: Map<string, string> = new Map(); // formKey -> processId

  constructor(private readonly dataDir: string) {
    this.processesDir = path.join(dataDir, "processes");
  }

  /**
   * Initialize storage: load all processes into memory cache.
   * Called once at startup.
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.processesDir, { recursive: true });
      const files = await fs.readdir(this.processesDir);
      
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        
        try {
          const filePath = path.join(this.processesDir, file);
          const content = await fs.readFile(filePath, "utf-8");
          const pkg = JSON.parse(content);
          
          // Validate against schema
          const validated = ProcessPackageSchema.parse(pkg);
          
          // Cache by ID
          const cacheKey = `${validated.id}:${validated.version}`;
          this.cache.set(cacheKey, validated);
          
          // Index by FormKeys
          for (const formKey of validated.formKeys) {
            this.formKeyIndex.set(formKey.toLowerCase(), cacheKey);
          }
        } catch (err) {
          console.error(`Failed to load process from ${file}:`, err);
        }
      }
      
      console.log(`[Vault] Loaded ${this.cache.size} processes, indexed ${this.formKeyIndex.size} FormKeys`);
    } catch (err) {
      console.error(`[Vault] Failed to initialize storage:`, err);
      throw err;
    }
  }

  async getProcess(id: string, version?: string): Promise<ProcessPackage | null> {
    if (version) {
      return this.cache.get(`${id}:${version}`) ?? null;
    }
    
    // Find latest version if not specified
    const versions = Array.from(this.cache.keys())
      .filter(key => key.startsWith(`${id}:`))
      .map(key => this.cache.get(key)!)
      .sort((a, b) => this.compareVersions(b.version, a.version));
    
    return versions[0] ?? null;
  }

  async getProcessByFormKey(formKey: string): Promise<ProcessPackage | null> {
    const cacheKey = this.formKeyIndex.get(formKey.toLowerCase());
    if (!cacheKey) return null;
    return this.cache.get(cacheKey) ?? null;
  }

  async listProcesses(filters?: {
    category?: string;
    jurisdiction?: string;
    tenantScope?: string;
  }): Promise<ProcessPackage[]> {
    let processes = Array.from(this.cache.values());
    
    if (filters?.tenantScope) {
      processes = processes.filter(pkg => {
        if (pkg.tenantScope === "all") return true;
        if (Array.isArray(pkg.tenantScope)) {
          return pkg.tenantScope.includes(filters.tenantScope!);
        }
        return false;
      });
    }
    
    // Sort by creation date (newest first)
    return processes.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async searchProcesses(query: string): Promise<ProcessPackage[]> {
    const lowerQuery = query.toLowerCase();
    const results = Array.from(this.cache.values()).filter(pkg => {
      return (
        pkg.title.toLowerCase().includes(lowerQuery) ||
        pkg.description.toLowerCase().includes(lowerQuery) ||
        pkg.formKeys.some(fk => fk.toLowerCase().includes(lowerQuery)) ||
        pkg.id.toLowerCase().includes(lowerQuery)
      );
    });
    
    return results.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getManifest(): Promise<VaultManifest> {
    const processes = Array.from(this.cache.values()).map(pkg => ({
      id: pkg.id,
      version: pkg.version,
      title: pkg.title,
      formKeys: pkg.formKeys,
      category: undefined,
      jurisdiction: undefined,
    }));
    
    return {
      processes,
      lastUpdated: new Date().toISOString(),
    };
  }

  async registerProcess(pkg: ProcessPackage): Promise<ProcessPackage> {
    // Validate schema
    const validated = ProcessPackageSchema.parse(pkg);
    
    // Validate integrity
    const validation = await this.validatePackage(validated);
    if (!validation.valid) {
      throw new Error(`Package validation failed: ${validation.errors.join(", ")}`);
    }
    
    // Write to filesystem
    const fileName = `${validated.id}-v${validated.version}.json`;
    const filePath = path.join(this.processesDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(validated, null, 2), "utf-8");
    
    // Update cache and index
    const cacheKey = `${validated.id}:${validated.version}`;
    this.cache.set(cacheKey, validated);
    
    for (const formKey of validated.formKeys) {
      this.formKeyIndex.set(formKey.toLowerCase(), cacheKey);
    }
    
    console.log(`[Vault] Registered process: ${validated.id} v${validated.version}`);
    return validated;
  }

  async validatePackage(pkg: ProcessPackage): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Validate planHash format
    if (!pkg.manifest.planHash.match(/^sha256:[a-f0-9]{64}$/)) {
      errors.push("Invalid planHash format");
    }
    
    // Validate asset hashes
    for (const asset of pkg.manifest.assets) {
      if (!asset.hash.match(/^sha256:[a-f0-9]{64}$/)) {
        errors.push(`Invalid asset hash for ${asset.path}`);
      }
    }
    
    // Validate FormKeys are unique
    const formKeySet = new Set(pkg.formKeys);
    if (formKeySet.size !== pkg.formKeys.length) {
      errors.push("Duplicate FormKeys detected");
    }
    
    // Validate M.G.L. citations
    if (pkg.mglCitations.length === 0) {
      errors.push("At least one M.G.L. citation required");
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Compare semantic versions (simple implementation).
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split(".").map(Number);
    const bParts = b.split(".").map(Number);
    
    for (let i = 0; i < 3; i++) {
      if (aParts[i] > bParts[i]) return 1;
      if (aParts[i] < bParts[i]) return -1;
    }
    
    return 0;
  }

  /**
   * Generate SHA-256 hash for content (utility for generating planHash).
   */
  static hashContent(content: string): string {
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    return `sha256:${hash}`;
  }
}
