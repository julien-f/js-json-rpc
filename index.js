'use strict';

//====================================================================

var inherits = require('util').inherits;

var asyncMethod = require('bluebird').method;
var Bluebird = require('bluebird');
var Duplex = require('readable-stream/duplex');
var has = require('lodash.has');
var isArray = require('lodash.isarray');
var isNull = require('lodash.isnull');
var isNumber = require('lodash.isnumber');
var isObject = require('lodash.isobject');
var isString = require('lodash.isstring');
var isUndefined = require('lodash.isundefined');
var keys = require('lodash.keys');
var map = require('lodash.map');

var JsonRpcError = require('./errors').JsonRpcError;

var InvalidJson = require('./errors').InvalidJson;
var InvalidRequest = require('./errors').InvalidRequest;
var MethodNotFound = require('./errors').MethodNotFound;
var UnknownError = require('./errors').UnknownError;

//====================================================================

function isInteger(value) {
  return isNumber(value) && (value % 1 === 0);
}

function xor(a, b) {
  /* jshint -W018 */

  return (!a !== !b);
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
    console.error(error && error.stack || error);

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

function formatResponse(id, result) {
  return {
    jsonrpc: '2.0',
    id: id,
    result: result,
  };
}
exports.formatResponse = formatResponse;

//--------------------------------------------------------------------

function JsonRpcServer(onReceive) {
  Duplex.call(this, {
    objectMode: true
  });

  this._handle = asyncMethod(onReceive);
  this._deferreds = Object.create(null);
}
inherits(JsonRpcServer, Duplex);

// Emit buffered outgoing messages.
JsonRpcServer.prototype._read = function () {};

// Receive and execute incoming messages.
JsonRpcServer.prototype._write = function (message, _, next) {
  var this_ = this;
  this.exec(message).then(function (response) {
    if (response) {
      this_.push(response);
    }

    next();
  });
};

JsonRpcServer.prototype.exec = asyncMethod(function JsonRpcServer$exec(message) {
  try {
    message = parse(message);
  } catch (error) {
    return formatError(message.id, error);
  }

  if (isArray(message))
  {
    return Bluebird.map(message, this.exec.bind(this));
  }

  var type = message.type;

  if (type === 'response')
  {
    var id = message.id;

    // Some errors do not have an identifier, simply discard them.
    if (id === undefined) {
      return;
    }

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

  var promise = this._handle(message).catch(MethodNotFound, function (error) {
    // If the method name is not defined, default to the method passed
    // in the request.
    if (!error.data) {
      throw new MethodNotFound(message.method);
    }

    throw error;
  });

  if (type === 'notification') {
    return;
  }

  return promise.then(
    function (result) {
      return formatResponse(message.id, result);
    },
    function (error) {
      return formatError(message.id, error);
    }
  );
});

// Fails all pending requests.
JsonRpcServer.prototype.failPendingRequests = function (reason) {
  var deferreds = this._deferreds;
  var ids = keys(deferreds);
  ids.forEach(function (id) {
    deferreds[id].reject(reason);
    delete deferreds[id];
  });
};

/**
 * This function should be called to send a request to the other end.
 *
 * TODO: handle multi-requests.
 */
JsonRpcServer.prototype.request = asyncMethod(function JsonRpcServer$request(method, params) {
  var request = formatRequest(method, params);
  this.push(request);

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

  return promise;
});

/**
 * This function should be called to send a notification to the other end.
 *
 * TODO: handle multi-notifications.
 */
JsonRpcServer.prototype.notify = asyncMethod(function JsonRpcServer$notify(method, params) {
  this.push(formatNotification(method, params));
});

// Compatibility.
JsonRpcServer.prototype.stream = function () {
  console.error(
    'jsonRpc: stream() is deprecated, the server is already a stream!'
  );

  return this;
};

//--------------------------------------------------------------------

exports.createServer = function (onReceive, onSend) {
  return new JsonRpcServer(onReceive, onSend);
};

// Compatibility.
Object.defineProperty(exports, 'create', {
  get: function () {
    console.error(
      'jsonRpc: create() is deprecated in favor of createServer()'
    );

    return exports.createServer;
  }
});
