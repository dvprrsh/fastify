"use strict";

import lru from "lru";
import destr from "destr";
import {
  kDefaultJsonParse,
  kContentTypeParser,
  kBodyLimit,
  kRequestPayloadStream,
  kState,
  kTestInternals,
} from "./symbols.js";

import {
  FST_ERR_CTP_INVALID_TYPE,
  FST_ERR_CTP_EMPTY_TYPE,
  FST_ERR_CTP_ALREADY_PRESENT,
  FST_ERR_CTP_INVALID_HANDLER,
  FST_ERR_CTP_INVALID_PARSE_TYPE,
  FST_ERR_CTP_BODY_TOO_LARGE,
  FST_ERR_CTP_INVALID_MEDIA_TYPE,
  FST_ERR_CTP_INVALID_CONTENT_LENGTH,
  FST_ERR_CTP_EMPTY_JSON_BODY,
} from "./errors.js";
import { emit } from "./warnings.js";

function ContentTypeParser(
  bodyLimit,
  onProtoPoisoning,
  onConstructorPoisoning
) {
  this[kDefaultJsonParse] = getDefaultJsonParser(
    onProtoPoisoning,
    onConstructorPoisoning
  );
  this.customParsers = {};
  this.customParsers["application/json"] = new Parser(
    true,
    false,
    bodyLimit,
    this[kDefaultJsonParse]
  );
  this.customParsers["text/plain"] = new Parser(
    true,
    false,
    bodyLimit,
    defaultPlainTextParser
  );
  this.parserList = ["application/json", "text/plain"];
  this.parserRegExpList = [];
  this.cache = lru(100);
}

ContentTypeParser.prototype.add = function (contentType, opts, parserFn) {
  const contentTypeIsString = typeof contentType === "string";

  if (!contentTypeIsString && !(contentType instanceof RegExp))
    throw new FST_ERR_CTP_INVALID_TYPE();
  if (contentTypeIsString && contentType.length === 0)
    throw new FST_ERR_CTP_EMPTY_TYPE();
  if (typeof parserFn !== "function") throw new FST_ERR_CTP_INVALID_HANDLER();

  if (this.existingParser(contentType)) {
    throw new FST_ERR_CTP_ALREADY_PRESENT(contentType);
  }

  if (opts.parseAs !== undefined) {
    if (opts.parseAs !== "string" && opts.parseAs !== "buffer") {
      throw new FST_ERR_CTP_INVALID_PARSE_TYPE(opts.parseAs);
    }
  }

  const parser = new Parser(
    opts.parseAs === "string",
    opts.parseAs === "buffer",
    opts.bodyLimit,
    parserFn
  );

  if (contentTypeIsString && contentType === "*") {
    this.customParsers[""] = parser;
  } else {
    if (contentTypeIsString) {
      if (contentType !== "application/json" && contentType !== "text/plain") {
        this.parserList.unshift(contentType);
      }
    } else {
      this.parserRegExpList.unshift(contentType);
    }
    this.customParsers[contentType] = parser;
  }
};

ContentTypeParser.prototype.hasParser = function (contentType) {
  return contentType in this.customParsers;
};

ContentTypeParser.prototype.existingParser = function (contentType) {
  if (contentType === "application/json") {
    return (
      this.customParsers["application/json"].fn !== this[kDefaultJsonParse]
    );
  }
  if (contentType === "text/plain") {
    return this.customParsers["text/plain"].fn !== defaultPlainTextParser;
  }

  return contentType in this.customParsers;
};

ContentTypeParser.prototype.getParser = function (contentType) {
  // eslint-disable-next-line no-var
  for (let i = 0; i !== this.parserList.length; ++i) {
    const parserName = this.parserList[i];
    if (contentType.indexOf(parserName) > -1) {
      const parser = this.customParsers[parserName];
      this.cache.set(contentType, parser);
      return parser;
    }
  }

  // eslint-disable-next-line no-var
  for (let j = 0; j !== this.parserRegExpList.length; ++j) {
    const parserRegExp = this.parserRegExpList[j];
    if (parserRegExp.test(contentType)) {
      const parser = this.customParsers[parserRegExp];
      this.cache.set(contentType, parser);
      return parser;
    }
  }

  return this.customParsers[""];
};

ContentTypeParser.prototype.run = function (
  contentType,
  handler,
  request,
  reply
) {
  const parser = this.cache.get(contentType) || this.getParser(contentType);

  if (parser === undefined) {
    reply.send(new FST_ERR_CTP_INVALID_MEDIA_TYPE(contentType));
  } else if (parser.asString === true || parser.asBuffer === true) {
    rawBody(request, reply, reply.context._parserOptions, parser, done);
  } else {
    let result;

    if (parser.isDeprecatedSignature) {
      result = parser.fn(request[kRequestPayloadStream], done);
    } else {
      result = parser.fn(request, request[kRequestPayloadStream], done);
    }

    if (result && typeof result.then === "function") {
      result.then((body) => done(null, body), done);
    }
  }

  function done(error, body) {
    if (error) {
      reply.send(error);
    } else {
      request.body = body;
      handler(request, reply);
    }
  }
};

function rawBody(request, reply, options, parser, done) {
  const asString = parser.asString;
  const limit = options.limit === null ? parser.bodyLimit : options.limit;
  const contentLength =
    request.headers["content-length"] === undefined
      ? NaN
      : Number.parseInt(request.headers["content-length"], 10);

  if (contentLength > limit) {
    reply.send(new FST_ERR_CTP_BODY_TOO_LARGE());
    return;
  }

  let receivedLength = 0;
  let body = asString === true ? "" : [];

  const payload = request[kRequestPayloadStream] || request.raw;

  if (asString === true) {
    payload.setEncoding("utf8");
  }

  payload.on("data", onData);
  payload.on("end", onEnd);
  payload.on("error", onEnd);
  payload.resume();

  function onData(chunk) {
    receivedLength += chunk.length;

    if ((payload.receivedEncodedLength || receivedLength) > limit) {
      payload.removeListener("data", onData);
      payload.removeListener("end", onEnd);
      payload.removeListener("error", onEnd);
      reply.send(new FST_ERR_CTP_BODY_TOO_LARGE());
      return;
    }

    if (asString === true) {
      body += chunk;
    } else {
      body.push(chunk);
    }
  }

  function onEnd(err) {
    payload.removeListener("data", onData);
    payload.removeListener("end", onEnd);
    payload.removeListener("error", onEnd);

    if (err !== undefined) {
      err.statusCode = 400;
      reply.code(err.statusCode).send(err);
      return;
    }

    if (asString === true) {
      receivedLength = Buffer.byteLength(body);
    }

    if (
      !Number.isNaN(contentLength) &&
      (payload.receivedEncodedLength || receivedLength) !== contentLength
    ) {
      reply.send(new FST_ERR_CTP_INVALID_CONTENT_LENGTH());
      return;
    }

    if (asString === false) {
      body = Buffer.concat(body);
    }

    const result = parser.fn(request, body, done);
    if (result && typeof result.then === "function") {
      result.then((body) => done(null, body), done);
    }
  }
}

function getDefaultJsonParser(_onProtoPoisoning, _onConstructorPoisoning) {
  return defaultJsonParser;

  function defaultJsonParser(_req, body, done) {
    if (body === "" || body == null) {
      return done(new FST_ERR_CTP_EMPTY_JSON_BODY(), undefined);
    }
    let json;
    try {
      json = destr(body);
    } catch (err) {
      err.statusCode = 400;
      return done(err, undefined);
    }
    done(null, json);
  }
}

function defaultPlainTextParser(_req, body, done) {
  done(null, body);
}

function Parser(asString, asBuffer, bodyLimit, fn) {
  this.asString = asString;
  this.asBuffer = asBuffer;
  this.bodyLimit = bodyLimit;
  this.fn = fn;

  // Check for deprecation syntax
  if (fn.length === (fn.constructor.name === "AsyncFunction" ? 1 : 2)) {
    emit("FSTDEP003");
    this.isDeprecatedSignature = true;
  }
}

function buildContentTypeParser(c) {
  const contentTypeParser = new ContentTypeParser();
  contentTypeParser[kDefaultJsonParse] = c[kDefaultJsonParse];
  Object.assign(contentTypeParser.customParsers, c.customParsers);
  contentTypeParser.parserList = c.parserList.slice();
  return contentTypeParser;
}

function addContentTypeParser(contentType, opts, parser) {
  if (this[kState].started) {
    throw new Error(
      'Cannot call "addContentTypeParser" when fastify instance is already started!'
    );
  }

  if (typeof opts === "function") {
    parser = opts;
    opts = {};
  }

  if (!opts) opts = {};
  if (!opts.bodyLimit) opts.bodyLimit = this[kBodyLimit];

  if (Array.isArray(contentType)) {
    contentType.forEach((type) =>
      this[kContentTypeParser].add(type, opts, parser)
    );
  } else {
    this[kContentTypeParser].add(contentType, opts, parser);
  }

  return this;
}

function hasContentTypeParser(contentType) {
  return this[kContentTypeParser].hasParser(contentType);
}

export default ContentTypeParser;
export const helpers = {
  buildContentTypeParser,
  addContentTypeParser,
  hasContentTypeParser,
};
export const defaultParsers = {
  getDefaultJsonParser,
  defaultTextParser: defaultPlainTextParser,
};
module.exports[kTestInternals] = { rawBody };
