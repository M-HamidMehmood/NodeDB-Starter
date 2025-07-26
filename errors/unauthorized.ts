import { CustomAPIError } from './custom-api';

export class UnauthorizedError extends CustomAPIError {
  constructor(message: string) {
    super(message, 403);
    this.name = 'UnauthorizedError';
  }
}

export default UnauthorizedError;
