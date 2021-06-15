import {
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerBase,
  RawServerDefault,
} from "./utils.d.ts";
import * as http from "http/mod.ts";

export type FastifyServerFactoryHandler<
  RawServer extends RawServerBase = RawServerDefault,
  RawRequest extends RawRequestDefaultExpression<RawServer> =
    RawRequestDefaultExpression<RawServer>,
  RawReply extends RawReplyDefaultExpression<RawServer> =
    RawReplyDefaultExpression<RawServer>,
> = (
  request: http.ServerRequest & RawRequest,
  response: http.Response & RawReply,
) => void;

export interface FastifyServerFactory<
  RawServer extends RawServerBase = RawServerDefault,
> {
  (
    handler: FastifyServerFactoryHandler<RawServer>,
    opts: Record<string, unknown>,
  ): RawServer;
}
