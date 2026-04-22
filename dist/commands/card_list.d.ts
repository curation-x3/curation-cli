interface CardListOptions {
    range?: string;
    since?: string;
    until?: string;
    page?: number;
    unread?: boolean;
    unreadByApp?: boolean;
    starred?: boolean;
}
export declare function cardListCommand(opts: CardListOptions): Promise<void>;
export {};
