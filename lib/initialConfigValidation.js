'use strict';

import validate, { errors, defaultInitOptions } from './configValidator';
const deepClone = require('rfdc')({ circles: true, proto: false });
import { FST_ERR_INIT_OPTS_INVALID } from './errors';

function validateInitialConfig(options) {
  const opts = deepClone(options);

  if (!validate(opts)) {
    const error = new FST_ERR_INIT_OPTS_INVALID(
      JSON.stringify(errors.map((e) => e.message))
    );
    error.errors = errors;
    throw error;
  }

  return deepFreezeObject(opts);
}

function deepFreezeObject(object) {
  const properties = Object.getOwnPropertyNames(object);

  for (const name of properties) {
    const value = object[name];

    if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
      continue;
    }

    object[name] =
      value && typeof value === 'object' ? deepFreezeObject(value) : value;
  }

  return Object.freeze(object);
}

export default validateInitialConfig;
export const defaultInitOptions = defaultInitOptions;
export const utils = { deepFreezeObject };
