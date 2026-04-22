interface UpdateCache {
    checked_at: string;
    latest_tag: string | null;
    status: "current" | "installing" | "auto_failed";
    fail_count?: number;
}
export declare function readUpdateCache(): UpdateCache | null;
/**
 * Background auto-update check. Called after main command completes.
 * Non-blocking, all errors silenced.
 */
export declare function maybeAutoUpdate(currentVersion: string): Promise<void>;
export {};
