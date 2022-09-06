import bcrypt from 'bcryptjs';

bcrypt.setRandomFallback((num: number) => Array.from(crypto.getRandomValues(new Int32Array(num))));

export const generateSalt = async (): Promise<string> => bcrypt.genSalt(10);

export const hashPassword = async (password: string, salt: string): Promise<string> => bcrypt.hash(password, salt);

export const comparePassword = async (s: string, hash: string): Promise<boolean> => bcrypt.compare(s, hash);
