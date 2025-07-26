import { CustomAPIError } from './custom-api';

export class UnauthenticatedError extends CustomAPIError {
  constructor(message: string) {
    super(message, 401);
    this.name = 'UnauthenticatedError';
  }
}

export default UnauthenticatedError;
