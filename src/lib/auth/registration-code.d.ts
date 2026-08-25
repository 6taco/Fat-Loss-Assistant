export declare function createRegistrationCode(): string;
export declare function isRegistrationCode(value: unknown): value is string;
export declare function hashRegistrationCode(code: string, secret?: string): string;
export declare function registrationCodeMatches(code: string, storedHash: string, secret?: string): boolean;
