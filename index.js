'use strict';

//====================================================================

var asyncMethod = require('bluebird').method;
var Bluebird = require('bluebird');
var has = require('lodash.has');
var isArray = require('lodash.isarray');
var isNull = require('lodash.isnull');
var isNumber = require('lodash.isnumber');
var isObject = require('lodash.isobject');
var isString = require('lodash.isstring');
var isUndefined = require('lodash.isundefined');
var map = require('lodash.map');

var JsonRpcError = require('./errors').JsonRpcError;

var InvalidJson = require('./errors').InvalidJson;
var InvalidRequest = require('./errors').InvalidRequest;
var UnknownError = require('./errors').UnknownError;

//====================================================================

function isInteger(value) {
  return isNumber(value) && (value % 1 === 0);
}

function xor(a, b) {
  return (a || b) && !(a && b);
}

//--------------------------------------------------------------------

var nextId = 0;

//====================================================================

// Parses, normalizes and validates a JSON-RPC message.
//
// The returns value is an object containing the normalized fields of
// the JSON-RPC message and an additional `type` field which contains
// one of the following: `notification`, request` or `response`.
function parse(message) {
  if (isString(message))
  {
    try
    {
      message = JSON.parse(message);
    }
    catch (error)
    {
      if (error instanceof SyntaxError) {
        throw new InvalidJson();
      }

      throw error;
    }
  }

  // Properly handle array of requests.
  if (isArray(message))
  {
    return map(message, parse);
  }

  if ('2.0' !== message.jsonrpc)
  {
    // Use the same errors for all JSON-RPC messages (requests,
    // responses and notifications).
    throw new InvalidRequest();
  }

  if (isString(message.method))
  {
    // Notification or request.

    var params = message.params;
    if (
      !isUndefined(params) &&
      !isArray(params) &&
      !isObject(params)
    )
    {
      throw new InvalidRequest();
    }

    var id = message.id;
    if (isUndefined(id))
    {
      message.type = 'notification';
    }
    else if (
      isNull(id) ||
      isNumber(id) ||
      isString(id)
    )
    {
      message.type = 'request';
    }
    else
    {
      throw new InvalidRequest();
    }
  }
  else
  {
    // Response.

    var error;
    if (!xor(
      has(message, 'result'),
      (
        has(message, 'error') &&
        isInteger((error = message.error).code) &&
        isString(error.message)
      )
    ))
    {
      throw new InvalidRequest();
    }

    message.type = 'response';
  }

  return message;
}
exports.parse = parse;

//--------------------------------------------------------------------

function formatRequest(method, params, id) {
  return {
    jsonrpc: '2.0',
    method: method,
    params: params || [],
    id: id || nextId++,
  };
}
exports.formatRequest = formatRequest;

//--------------------------------------------------------------------

function formatNotification(method, params) {
  return {
    jsonrpc: '2.0',
    method: method,
    params: params || [],
  };
}
exports.formatNotification = formatNotification;

//--------------------------------------------------------------------

function formatError(id, error) {
  // Hide internal errors.
  if (!(error instanceof JsonRpcError)) {
    // But log them because this should not happened!
    console.error(error.stack || error);

    error = new UnknownError();
  }

  return {
    jsonrpc: '2.0',
    id: id,
    error: {
      code: error.code,
      message: error.message,
      data: error.data,
    },
  };
}
exports.formatError = formatError;

//--------------------------------------------------------------------

function formatResult(id, result) {
  return {
    jsonrpc: '2.0',
    id: id,
    result: result,
  };
}
exports.formatResult = formatResult;

//--------------------------------------------------------------------

function JsonRpc(onReceive, onSend) {
  this._handle = asyncMethod(onReceive);
  this._write = onSend && asyncMethod(onSend);

  this._deferreds = Object.create(null);
}

/**
 * This function should be called each time a new message is received.
 */
JsonRpc.prototype.exec = asyncMethod(function JsonRpc$exec(message) {
  message = parse(message);

  if (isArray(message))
  {
    return map(message, this.exec, this);
  }

  var type = message.type;

  if (type === 'response')
  {
    var id = message.id;
    var deferred = this._deferreds[id];

    if (!deferred)
    {
      throw new Error('no such deferred');
    }

    delete this._deferreds[id];

    if (has(message, 'error'))
    {
      deferred.reject(message.error);
    }
    else
    {
      deferred.resolve(message.result);
    }

    return;
  }

  var promise = this._handle(message);

  if (type === 'request') {
    var write = this._write;

    promise = promise.then(
      function (result) {
        return write(formatResult(message.id, result));
      },
      function (error) {
        return write(formatError(message.id, error));
      }
    );
  }

  return promise;
});

/**
 * This function should be called to send a request to the other end.
 *
 * TODO: handle multi-requests.
 */
JsonRpc.prototype.request = asyncMethod(function JsonRpc$request(method, params) {
  var request = formatRequest(method, params);

  // https://github.com/petkaantonov/bluebird/blob/master/API.md#deferred-migration
  var promise, resolve, reject;
  promise = new Bluebird(function (resolve_, reject_) {
    resolve = resolve_;
    reject = reject_;
  });
  this._deferreds[request.id] = {
    resolve: resolve,
    reject: reject,
  };

  return this._write(request).return(promise);
});

/**
 * This function should be called to send a notification to the other end.
 *
 * TODO: handle multi-notifications.
 */
JsonRpc.prototype.notify = asyncMethod(function JsonRpc$notify(method, params) {
  var notification = formatNotification(method, params);

  return this._write(notification);
});

//--------------------------------------------------------------------

exports.create = function (onReceive, onSend) {
  return new JsonRpc(onReceive, onSend);
};
