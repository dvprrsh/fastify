"use strict";

import {
  kAvvioBoot,
  kChildren,
  kRoutePrefix,
  kLogLevel,
  kLogSerializers,
  kHooks,
  kSchemaController,
  kContentTypeParser,
  kReply,
  kRequest,
  kFourOhFour,
  kPluginNameChain,
} from "./symbols.js";

import { buildReply } from "./reply.js";
import { buildRequest } from "./request.js";
import { buildSchemaController } from "./schema-controller.js";
import { helpers } from "./contentTypeParser.js";
import { buildHooks } from "./hooks.js";
import {
  registerPlugin,
  getDisplayName,
  registeredPlugins,
  getPluginName,
  getFuncPreview,
} from "./pluginUtils.js";

// Function that runs the encapsulation magic.
// Everything that need to be encapsulated must be handled in this function.
export default function override(old, fn, opts) {
  const shouldSkipOverride = registerPlugin.call(old, fn);

  if (shouldSkipOverride) {
    // after every plugin registration we will enter a new name
    old[kPluginNameChain].push(getDisplayName(fn));
    return old;
  }

  const instance = Object.create(old);
  old[kChildren].push(instance);
  instance.ready = old[kAvvioBoot].bind(instance);
  instance[kChildren] = [];

  instance[kReply] = buildReply(instance[kReply]);
  instance[kReply].prototype.server = instance;

  instance[kRequest] = buildRequest(instance[kRequest]);
  instance[kRequest].prototype.server = instance;

  instance[kContentTypeParser] = helpers.buildContentTypeParser(
    instance[kContentTypeParser]
  );
  instance[kHooks] = buildHooks(instance[kHooks]);
  instance[kRoutePrefix] = buildRoutePrefix(
    instance[kRoutePrefix],
    opts.prefix
  );
  instance[kLogLevel] = opts.logLevel || instance[kLogLevel];
  instance[kSchemaController] = buildSchemaController(old[kSchemaController]);
  instance.getSchema = instance[kSchemaController].getSchema.bind(
    instance[kSchemaController]
  );
  instance.getSchemas = instance[kSchemaController].getSchemas.bind(
    instance[kSchemaController]
  );
  instance[registeredPlugins] = Object.create(instance[registeredPlugins]);
  instance[kPluginNameChain] = [getPluginName(fn) || getFuncPreview(fn)];

  if (instance[kLogSerializers] || opts.logSerializers) {
    instance[kLogSerializers] = Object.assign(
      Object.create(instance[kLogSerializers]),
      opts.logSerializers
    );
  }

  if (opts.prefix) {
    instance[kFourOhFour].arrange404(instance);
  }

  for (const hook of instance[kHooks].onRegister)
    hook.call(this, instance, opts);

  return instance;
}

function buildRoutePrefix(instancePrefix, pluginPrefix) {
  if (!pluginPrefix) {
    return instancePrefix;
  }

  // Ensure that there is a '/' between the prefixes
  if (instancePrefix.endsWith("/") && pluginPrefix[0] === "/") {
    // Remove the extra '/' to avoid: '/first//second'
    pluginPrefix = pluginPrefix.slice(1);
  } else if (pluginPrefix[0] !== "/") {
    pluginPrefix = "/" + pluginPrefix;
  }

  return instancePrefix + pluginPrefix;
}
