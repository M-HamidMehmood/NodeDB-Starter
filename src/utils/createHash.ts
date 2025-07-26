import crypto from 'crypto';

const createHash = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

export default createHash;
