export declare function getToken(key: "access_token" | "refresh_token"): Promise<string | null>;
export declare function setToken(key: "access_token" | "refresh_token", value: string): Promise<void>;
export declare function deleteToken(key: "access_token" | "refresh_token"): Promise<void>;
export declare function clearAll(): Promise<void>;
