// deno-lint-ignore-file no-explicit-any ban-types
// import { ConstraintStrategy, HTTPVersion } from "find_my_way";
import * as http from "http/mod.ts";
import { FastifyRequest, RequestGenericInterface } from "./types/request.d.ts";
import {
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerBase,
  RawServerDefault,
} from "./types/utils.d.ts";
import {
  FastifyLoggerInstance,
  FastifyLoggerOptions,
} from "./types/logger.d.ts";
import { FastifyInstance } from "./types/instance.d.ts";
import { FastifyServerFactory } from "./types/serverFactory.d.ts";
import { Options as AjvOptions } from "fastify_ajv_compiler";
import { FastifyError } from "fastify_error";
import { FastifyReply } from "./types/reply.d.ts";
import { FastifySchemaValidationError } from "./types/schema.d.ts";
import {
  ConstructorAction,
  ProtoAction,
} from "./types/content-type-parser.d.ts";

/**
 * Fastify factory function for the standard fastify http, http, or http server instance.
 *
 * The default function utilizes http
 *
 * @param opts Fastify server options
 * @returns Fastify server instance
 */
declare function fastify<
  Server extends http.Server,
  Request extends RawRequestDefaultExpression<Server> =
    RawRequestDefaultExpression<Server>,
  Reply extends RawReplyDefaultExpression<Server> = RawReplyDefaultExpression<
    Server
  >,
  Logger extends FastifyLoggerInstance = FastifyLoggerInstance,
>(
  opts: FastifyHttp2SecureOptions<Server, Logger>,
):
  & FastifyInstance<Server, Request, Reply, Logger>
  & PromiseLike<FastifyInstance<Server, Request, Reply, Logger>>;
declare function fastify<
  Server extends http.Server,
  Request extends RawRequestDefaultExpression<Server> =
    RawRequestDefaultExpression<Server>,
  Reply extends RawReplyDefaultExpression<Server> = RawReplyDefaultExpression<
    Server
  >,
  Logger extends FastifyLoggerInstance = FastifyLoggerInstance,
>(
  opts: FastifyHttp2Options<Server, Logger>,
):
  & FastifyInstance<Server, Request, Reply, Logger>
  & PromiseLike<FastifyInstance<Server, Request, Reply, Logger>>;
declare function fastify<
  Server extends http.Server,
  Request extends RawRequestDefaultExpression<Server> =
    RawRequestDefaultExpression<Server>,
  Reply extends RawReplyDefaultExpression<Server> = RawReplyDefaultExpression<
    Server
  >,
  Logger extends FastifyLoggerInstance = FastifyLoggerInstance,
>(
  opts: FastifyHttpsOptions<Server, Logger>,
):
  & FastifyInstance<Server, Request, Reply, Logger>
  & PromiseLike<FastifyInstance<Server, Request, Reply, Logger>>;
declare function fastify<
  Server extends http.Server,
  Request extends RawRequestDefaultExpression<Server> =
    RawRequestDefaultExpression<Server>,
  Reply extends RawReplyDefaultExpression<Server> = RawReplyDefaultExpression<
    Server
  >,
  Logger extends FastifyLoggerInstance = FastifyLoggerInstance,
>(
  opts?: FastifyServerOptions<Server, Logger>,
):
  & FastifyInstance<Server, Request, Reply, Logger>
  & PromiseLike<FastifyInstance<Server, Request, Reply, Logger>>;
export default fastify;

export type FastifyHttp2SecureOptions<
  Server extends http.Server,
  Logger extends FastifyLoggerInstance = FastifyLoggerInstance,
> = FastifyServerOptions<Server, Logger> & {
  http2: true;
  https: http.HTTPSOptions;
};

export type FastifyHttp2Options<
  Server extends http.Server,
  Logger extends FastifyLoggerInstance = FastifyLoggerInstance,
> = FastifyServerOptions<Server, Logger> & {
  http2: true;
  http2SessionTimeout?: number;
};

export type FastifyHttpsOptions<
  Server extends http.Server,
  Logger extends FastifyLoggerInstance = FastifyLoggerInstance,
> = FastifyServerOptions<Server, Logger> & {
  https: http.HTTPOptions;
};

type FindMyWayVersion<RawServer extends RawServerBase> = RawServer extends
  http.Server ? any /*HTTPVersion.V1*/ : any /*HTTPVersion.V2*/;

export interface ConnectionError extends Error {
  code: string;
  bytesParsed: number;
  rawPacket: {
    type: string;
    data: number[];
  };
}

/**
 * Options for a fastify server instance. Utilizes conditional logic on the generic server parameter to enforce certain http and http
 */
export type FastifyServerOptions<
  RawServer extends RawServerBase = RawServerDefault,
  Logger extends FastifyLoggerInstance = FastifyLoggerInstance,
> = {
  ignoreTrailingSlash?: boolean;
  connectionTimeout?: number;
  keepAliveTimeout?: number;
  pluginTimeout?: number;
  bodyLimit?: number;
  maxParamLength?: number;
  disableRequestLogging?: boolean;
  exposeHeadRoutes?: boolean;
  onProtoPoisoning?: ProtoAction;
  onConstructorPoisoning?: ConstructorAction;
  logger?: boolean | FastifyLoggerOptions<RawServer> | Logger;
  serverFactory?: FastifyServerFactory<RawServer>;
  caseSensitive?: boolean;
  requestIdHeader?: string;
  requestIdLogLabel?: string;
  genReqId?: <
    RequestGeneric extends RequestGenericInterface = RequestGenericInterface,
  >(
    req: FastifyRequest<
      RequestGeneric,
      RawServer,
      RawRequestDefaultExpression<RawServer>
    >,
  ) => string;
  trustProxy?: boolean | string | string[] | number | TrustProxyFunction;
  querystringParser?: (str: string) => { [key: string]: unknown };
  /**
   * @deprecated Prefer using the `constraints.version` property
   */
  versioning?: {
    storage(): {
      get(version: string): string | null;
      set(version: string, store: Function): void;
      del(version: string): void;
      empty(): void;
    };
    deriveVersion<Context>(req: Object, ctx?: Context): string; // not a fan of using Object here. Also what is Context? Can either of these be better defined?
  };
  constraints?: {
    [name: string]: any /*ConstraintStrategy<FindMyWayVersion<RawServer>>*/;
  };
  return503OnClosing?: boolean;
  ajv?: {
    customOptions?: AjvOptions;
    plugins?: Function[];
  };
  frameworkErrors?: <
    RequestGeneric extends RequestGenericInterface = RequestGenericInterface,
  >(
    error: FastifyError,
    req: FastifyRequest<
      RequestGeneric,
      RawServer,
      RawRequestDefaultExpression<RawServer>
    >,
    res: FastifyReply<
      RawServer,
      RawRequestDefaultExpression<RawServer>,
      RawReplyDefaultExpression<RawServer>
    >,
  ) => void;
  rewriteUrl?: (req: RawRequestDefaultExpression<RawServer>) => string;
  schemaErrorFormatter?: (
    errors: FastifySchemaValidationError[],
    dataVar: string,
  ) => Error;
  /**
   * listener to error events emitted by client connections
   */
  clientErrorHandler?: (error: ConnectionError, socket: any /*Socket*/) => void;
};

type TrustProxyFunction = (address: string, hop: number) => boolean;

declare module "fastify_error" {
  interface FastifyError {
    validation?: ValidationResult[];
  }
}

export interface ValidationResult {
  keyword: string;
  dataPath: string;
  schemaPath: string;
  params: Record<string, string | string[]>;
  message: string;
}

/* Export all additional types */
export {
  CallbackFunc as LightMyRequestCallback,
  Chain as LightMyRequestChain,
  InjectOptions,
  Response as LightMyRequestResponse,
} from "light_my_request";
export { FastifyRequest, RequestGenericInterface } from "./types/request.d.ts";
export { FastifyReply } from "./types/reply.d.ts";
export {
  FastifyPlugin,
  FastifyPluginAsync,
  FastifyPluginCallback,
  FastifyPluginOptions,
} from "./types/plugin.d.ts";
export { FastifyInstance } from "./types/instance.d.ts";
export {
  FastifyLogFn,
  FastifyLoggerInstance,
  FastifyLoggerOptions,
  LogLevel,
} from "./types/logger.d.ts";
export { FastifyContext, FastifyContextConfig } from "./types/context.d.ts";
export {
  RouteHandler,
  RouteHandlerMethod,
  RouteOptions,
  RouteShorthandMethod,
  RouteShorthandOptions,
  RouteShorthandOptionsWithHandler,
} from "./types/route.d.ts";
export * from "./types/register.d.ts";
export {
  AddContentTypeParser,
  ConstructorAction,
  FastifyBodyParser,
  FastifyContentTypeParser,
  getDefaultJsonParser,
  hasContentTypeParser,
  ProtoAction,
} from "./types/content-type-parser.d.ts";
export { FastifyError } from "fastify_error";
export { FastifySchema, FastifySchemaCompiler } from "./types/schema.d.ts";
export {
  ContextConfigDefault,
  HTTPMethods,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerBase,
  RawServerDefault,
  RequestBodyDefault,
  RequestHeadersDefault,
  RequestParamsDefault,
  RequestQuerystringDefault,
} from "./types/utils.d.ts";
export * from "./types/hooks.d.ts";
export {
  FastifyServerFactory,
  FastifyServerFactoryHandler,
} from "./types/serverFactory.d.ts";
export { fastify };
