export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, encodedHash: string): Promise<boolean>;
