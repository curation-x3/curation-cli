export interface StoredUser {
    user_id: number;
    username: string;
    email: string | null;
    role: string;
}
export declare function readUser(): StoredUser | null;
export declare function writeUser(user: StoredUser): void;
export declare function deleteUser(): void;
