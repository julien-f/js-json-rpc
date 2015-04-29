'use strict'

// ===================================================================

var makeError = require('make-error')

// ===================================================================

function JsonRpcError (message, code, data) {
  JsonRpcError.super.call(
    this,
    message === undefined ?
      'unknown error from the peer' :
      message
  )

  this.code = code === undefined ?
    -32000 :
    code

  if (data !== undefined) {
    this.data = data
  }
}
makeError(JsonRpcError)
exports.JsonRpcError = JsonRpcError

// -------------------------------------------------------------------

function InvalidJson () {
  InvalidJson.super.call(this, 'invalid JSON', -32700)
}
makeError(InvalidJson, JsonRpcError)
exports.InvalidJson = InvalidJson

// -------------------------------------------------------------------

function InvalidRequest () {
  InvalidRequest.super.call(this, 'invalid JSON-RPC request', -32600)
}
makeError(InvalidRequest, JsonRpcError)
exports.InvalidRequest = InvalidRequest

// -------------------------------------------------------------------

function MethodNotFound (method) {
  var message = method ?
    'method not found: ' + method :
    'method not found'

  MethodNotFound.super.call(this, message, -32601, method)
}
makeError(MethodNotFound, JsonRpcError)
exports.MethodNotFound = MethodNotFound

// -------------------------------------------------------------------

function InvalidParameters (data) {
  InvalidParameters.super.call(this, 'invalid parameter(s)', -32602, data)
}
makeError(InvalidParameters, JsonRpcError)
exports.InvalidParameters = InvalidParameters

// -------------------------------------------------------------------

function UnknownError () {
  UnknownError.super.call(this)
}
makeError(UnknownError, JsonRpcError)
exports.UnknownError = UnknownError

// ===================================================================

// Ensure maximum import compatibility with Babel.
Object.defineProperty(exports, '__esModule', {
  value: true
})
