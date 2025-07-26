import { CustomAPIError } from './custom-api';

export class BadRequestError extends CustomAPIError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

export default BadRequestError;
