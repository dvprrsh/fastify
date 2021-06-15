'use strict';

import { kReplyIsError, kReplySent, kReplySentOverwritten } from './symbols.js';

import { FST_ERR_PROMISE_NOT_FULFILLED } from './errors.js';

function wrapThenable(thenable, reply) {
  thenable.then(
    function (payload) {
      if (reply[kReplySentOverwritten] === true) {
        return;
      }

      // this is for async functions that
      // are using reply.send directly
      if (
        payload !== undefined ||
        (reply.raw.statusCode === 204 && reply[kReplySent] === false)
      ) {
        // we use a try-catch internally to avoid adding a catch to another
        // promise, increase promise perf by 10%
        try {
          reply.send(payload);
        } catch (err) {
          reply[kReplySent] = false;
          reply[kReplyIsError] = true;
          reply.send(err);
        }
      } else if (reply[kReplySent] === false) {
        reply.log.error(
          { err: new FST_ERR_PROMISE_NOT_FULFILLED() },
          "Promise may not be fulfilled with 'undefined' when statusCode is not 204"
        );
      }
    },
    function (err) {
      if (reply[kReplySentOverwritten] === true || reply.sent === true) {
        reply.log.error(
          { err },
          'Promise errored, but reply.sent = true was set'
        );
        return;
      }

      reply[kReplySent] = false;
      reply[kReplyIsError] = true;
      reply.send(err);
    }
  );
}

export default wrapThenable;
