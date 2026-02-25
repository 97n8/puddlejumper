export interface RuleSetVersion {
  version: string;
  effectiveDate: string;
  approvedBy: string;
  path: string;
  archivedAt?: string;
}

export class RuleSetVersionRegistry {
  private versions: RuleSetVersion[] = [];

  register(entry: RuleSetVersion): void {
    this.versions.push(entry);
  }

  current(): RuleSetVersion | undefined {
    return this.versions.filter(v => !v.archivedAt).at(-1);
  }

  history(): RuleSetVersion[] {
    return [...this.versions];
  }
}
