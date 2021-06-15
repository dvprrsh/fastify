import * as http from "http/mod.ts";

/**
 * Standard HTTP method strings
 */
export type HTTPMethods =
  | "DELETE"
  | "GET"
  | "HEAD"
  | "PATCH"
  | "POST"
  | "PUT"
  | "OPTIONS";

/**
 * A union type of the Node.js server types from the http, https, and http2 modules.
 */
export type RawServerBase = http.Server;
/**
 * The default server type
 */
export type RawServerDefault = http.Server;

/**
 * The default request type based on the server type. Utilizes generic constraining.
 */
export type RawRequestDefaultExpression<
  RawServer extends RawServerBase = RawServerDefault,
> = http.ServerRequest;

/**
 * The default reply type based on the server type. Utilizes generic constraining.
 */
export type RawReplyDefaultExpression<
  RawServer extends RawServerBase = RawServerDefault,
> = Response;

export type RequestBodyDefault = unknown;
export type RequestQuerystringDefault = unknown;
export type RequestParamsDefault = unknown;
export type RequestHeadersDefault = unknown;

export type ContextConfigDefault = unknown;
export type ReplyDefault = unknown;
