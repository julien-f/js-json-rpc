'use strict'

// ===================================================================

var inherits = require('util').inherits

var asyncMethod = require('bluebird').method
var Bluebird = require('bluebird')
var Duplex = require('readable-stream/duplex')
var has = require('lodash.has')
var isArray = require('lodash.isarray')
var keys = require('lodash.keys')

var JsonRpcError = require('./errors').JsonRpcError
var MethodNotFound = require('./errors').MethodNotFound
var format = require('./format')
var parse = require('./parse')

// ===================================================================

// Default onMessage implementation:
//
// - ignores notifications
// - throw MethodNotFound for all requests
function defaultOnMessage (message) {
  if (message.type === 'request') {
    throw new MethodNotFound()
  }
}

var toJson = JSON.stringify

// ===================================================================

function JsonRpcPeer (onMessage) {
  Duplex.call(this, {
    objectMode: true
  })

  this._handle = asyncMethod(onMessage || defaultOnMessage)
  this._deferreds = Object.create(null)

  // Forward the end of the stream.
  this.on('finish', function () {
    this.push(null)
  })
}
inherits(JsonRpcPeer, Duplex)

// Emit buffered outgoing messages.
JsonRpcPeer.prototype._read = function () {}

// Receive and execute incoming messages.
JsonRpcPeer.prototype._write = function (message, _, next) {
  var this_ = this
  this.exec(String(message)).then(function (response) {
    if (response) {
      this_.push(response)
    }
  }).catch(function (error) {
    this_.emit('error', error)
  })

  next()
}

JsonRpcPeer.prototype.exec = asyncMethod(function JsonRpcPeer$exec (message) {
  try {
    message = parse(message)
  } catch (error) {
    return toJson(format.error(message.id, error))
  }

  if (isArray(message)) {
    var self = this
    var results = []

    // Only returns non empty results.
    return Bluebird.each(message, function (message) {
      return self.exec(message).then(function (result) {
        if (result) results.push(result)
      })
    }).return(results)
  }

  var type = message.type

  if (type === 'response') {
    var id = message.id

    // Some errors do not have an identifier, simply discard them.
    if (id === undefined) {
      return
    }

    var deferred = this._deferreds[id]

    if (!deferred) {
      throw new Error('no such deferred')
    }

    delete this._deferreds[id]

    if (has(message, 'error')) {
      var error = message.error

      // TODO: it would be great if we could return an error with of a
      // more specific type (and custom types with registration).
      deferred.reject(new JsonRpcError(
        error.message,
        error.code,
        error.data
      ))
    } else {
      deferred.resolve(message.result)
    }

    return
  }

  var promise = this._handle(message).catch(MethodNotFound, function (error) {
    // If the method name is not defined, default to the method passed
    // in the request.
    if (!error.data) {
      throw new MethodNotFound(message.method)
    }

    throw error
  })

  if (type === 'notification') {
    return
  }

  return promise.then(
    function (result) {
      return toJson(format.response(message.id, result))
    },
    function (error) {
      return toJson(format.error(message.id, error))
    }
  )
})

// Fails all pending requests.
JsonRpcPeer.prototype.failPendingRequests = function (reason) {
  var deferreds = this._deferreds
  var ids = keys(deferreds)
  ids.forEach(function (id) {
    deferreds[id].reject(reason)
    delete deferreds[id]
  })
}

/**
 * This function should be called to send a request to the other end.
 *
 * TODO: handle multi-requests.
 */
JsonRpcPeer.prototype.request = asyncMethod(function JsonRpcPeer$request (method, params) {
  var request = format.request(method, params)
  this.push(toJson(request))

  // https://github.com/petkaantonov/bluebird/blob/master/API.md#deferred-migration
  var promise, resolve, reject
  promise = new Bluebird(function (resolve_, reject_) {
    resolve = resolve_
    reject = reject_
  })
  this._deferreds[request.id] = {
    resolve: resolve,
    reject: reject
  }

  return promise
})

/**
 * This function should be called to send a notification to the other end.
 *
 * TODO: handle multi-notifications.
 */
JsonRpcPeer.prototype.notify = asyncMethod(function JsonRpcPeer$notify (method, params) {
  this.push(toJson(format.notification(method, params)))
})

// -------------------------------------------------------------------

exports.createPeer = function (onMessage) {
  return new JsonRpcPeer(onMessage)
}

// ===================================================================

// Ensure maximum import compatibility with Babel.
Object.defineProperty(exports, '__esModule', {
  value: true
})
