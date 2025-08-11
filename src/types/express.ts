import { Request } from 'express';

export type AuthenticatedRequest = Request & {
  user: {
    id: number;
    email: string;
    name: string;
    permissions: string[];
  };
};
