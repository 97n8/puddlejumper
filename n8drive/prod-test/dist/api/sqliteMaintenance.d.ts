type RestoreValidation = {
    ok: boolean;
    path: string;
    tables: string[];
    issues: string[];
};
export declare function exportSqliteDatabase(sourcePath: string, destinationPath: string): Promise<string>;
export declare function validateSqliteRestore(dbPath: string): RestoreValidation;
export {};
