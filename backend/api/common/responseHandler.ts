import { Response } from "express";

export enum ResponseCode {
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
}

export function sendResponse<T>(
  res: Response,
  {
    statusCode = 200,
    responseCode = ResponseCode.SUCCESS,
    body,
  }: {
    statusCode?: number;
    responseCode?: ResponseCode;
    body: T;
  }
) {
  return res.status(statusCode).json({
    statusCode,
    responseCode,
    body,
  });
}