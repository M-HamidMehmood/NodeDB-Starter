import BadRequestError from './bad-request';
import CustomAPIError from './custom-api';
import NotFoundError from './not-found';
import UnauthenticatedError from './unauthenticated';
import UnauthorizedError from './unauthorized';

export { BadRequestError, CustomAPIError, NotFoundError, UnauthenticatedError, UnauthorizedError };

export default {
  CustomAPIError,
  BadRequestError,
  NotFoundError,
  UnauthenticatedError,
  UnauthorizedError,
};
