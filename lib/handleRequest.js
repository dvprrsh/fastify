"use strict";

import { validate as validateSchema } from "./validation.js";
import { hookRunner, hookIterator } from "./hooks.js";
import wrapThenable from "./wrapThenable.js";

function handleRequest(err, request, reply) {
  if (reply.sent === true) return;
  if (err != null) {
    reply.send(err);
    return;
  }

  const method = request.raw.method;
  const headers = request.headers;

  if (method === "GET" || method === "HEAD") {
    handler(request, reply);
    return;
  }

  const contentType = headers["content-type"];

  if (method === "POST" || method === "PUT" || method === "PATCH") {
    if (contentType === undefined) {
      if (
        headers["transfer-encoding"] === undefined &&
        (headers["content-length"] === "0" ||
          headers["content-length"] === undefined)
      ) {
        // Request has no body to parse
        handler(request, reply);
      } else {
        reply.context.contentTypeParser.run("", handler, request, reply);
      }
    } else {
      reply.context.contentTypeParser.run(contentType, handler, request, reply);
    }
    return;
  }

  if (method === "OPTIONS" || method === "DELETE") {
    if (
      contentType !== undefined &&
      (headers["transfer-encoding"] !== undefined ||
        headers["content-length"] !== undefined)
    ) {
      reply.context.contentTypeParser.run(contentType, handler, request, reply);
    } else {
      handler(request, reply);
    }
    return;
  }

  // Return 404 instead of 405 see https://github.com/fastify/fastify/pull/862 for discussion
  reply.code(404).send(new Error("Not Found"));
}

function handler(request, reply) {
  try {
    if (reply.context.preValidation !== null) {
      hookRunner(
        reply.context.preValidation,
        hookIterator,
        request,
        reply,
        preValidationCallback
      );
    } else {
      preValidationCallback(null, request, reply);
    }
  } catch (err) {
    preValidationCallback(err, request, reply);
  }
}

function preValidationCallback(err, request, reply) {
  if (
    reply.sent === true ||
    reply.raw.writableEnded === true ||
    reply.raw.writable === false
  )
    return;

  if (err != null) {
    reply.send(err);
    return;
  }

  const result = validateSchema(reply.context, request);
  if (result) {
    if (reply.context.attachValidation === false) {
      reply.code(400).send(result);
      return;
    }

    reply.request.validationError = result;
  }

  // preHandler hook
  if (reply.context.preHandler !== null) {
    hookRunner(
      reply.context.preHandler,
      hookIterator,
      request,
      reply,
      preHandlerCallback
    );
  } else {
    preHandlerCallback(null, request, reply);
  }
}

function preHandlerCallback(err, request, reply) {
  if (
    reply.sent ||
    reply.raw.writableEnded === true ||
    reply.raw.writable === false
  )
    return;

  if (err != null) {
    reply.send(err);
    return;
  }

  let result;

  try {
    result = reply.context.handler(request, reply);
  } catch (err) {
    reply.send(err);
    return;
  }

  if (result !== undefined) {
    if (result !== null && typeof result.then === "function") {
      wrapThenable(result, reply);
    } else {
      reply.send(result);
    }
  }
}

export default handleRequest;
module.exports[Symbol.for("internals")] = { handler, preHandlerCallback };
