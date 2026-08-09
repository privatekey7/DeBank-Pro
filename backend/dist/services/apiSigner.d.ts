export type SignResult = {
    signature: string;
    nonce: string;
    ts: number;
    version: string;
};
export declare const generateNonce: () => string;
/**
 * Подпись запроса. `nonce`/`ts` передаются явно только в тестах — в проде
 * генерируются автоматически.
 */
export declare const signRequest: (prefix: string, method: string, path: string, params: Record<string, string>, nonce?: string, ts?: number) => SignResult;
//# sourceMappingURL=apiSigner.d.ts.map