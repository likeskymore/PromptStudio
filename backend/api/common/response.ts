export enum ResponseCode {
  SUCCESS = "SUCCESS",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export interface Entity<T> {
  statusCode: number;
  responseCode: string;
  body: T;
}