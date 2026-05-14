import type { ProcessPackage, VaultManifest } from "./schema.js";

/**
 * VaultStorage Interface
 * 
 * Abstract storage layer for process packages. Implementations can use:
 * - FileSystem (initial implementation)
 * - Object Store (S3, GCS)
 * - Database (PostgreSQL, MongoDB)
 */
export interface VaultStorage {
  /**
   * Retrieve a process package by ID and optional version.
   * Returns the latest version if version is not specified.
   */
  getProcess(id: string, version?: string): Promise<ProcessPackage | null>;

  /**
   * Retrieve a process package by FormKey.
   * FormKeys can map to multiple process IDs.
   */
  getProcessByFormKey(formKey: string): Promise<ProcessPackage | null>;

  /**
   * List all available processes with optional filters.
   */
  listProcesses(filters?: {
    category?: string;
    jurisdiction?: string;
    tenantScope?: string;
  }): Promise<ProcessPackage[]>;

  /**
   * Search processes by text query (title, description, formKeys).
   */
  searchProcesses(query: string): Promise<ProcessPackage[]>;

  /**
   * Get the vault manifest (index of all processes).
   */
  getManifest(): Promise<VaultManifest>;

  /**
   * Register a new process package (admin operation).
   * Returns the created package with validated hashes.
   */
  registerProcess(pkg: ProcessPackage): Promise<ProcessPackage>;

  /**
   * Validate a process package's integrity (planHash, asset hashes).
   */
  validatePackage(pkg: ProcessPackage): Promise<{ valid: boolean; errors: string[] }>;
}
