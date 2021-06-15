"use strict";

import fastJsonStringify from "fast_json_stringify";

function serializerFactory(externalSchemas, serializerOpts) {
  const opts = Object.assign({}, serializerOpts, { schema: externalSchemas });
  return function responseSchemaCompiler({
    schema /* method, url, httpStatus */,
  }) {
    return fastJsonStringify(schema, opts);
  };
}

export const serializerCompiler = serializerFactory;
