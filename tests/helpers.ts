import { AxiosError, type AxiosResponse } from 'axios';

// What axios rejects with when the default validateStatus refuses a response.
export function httpFailure(status: number, statusText: string, data: unknown = null): AxiosError {
  const response = { status, statusText, headers: {}, data, config: {} } as AxiosResponse;
  return new AxiosError(
    `Request failed with status code ${status}`,
    status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    undefined,
    {},
    response
  );
}
