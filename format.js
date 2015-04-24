'use strict'

// ===================================================================

var JsonRpcError = require('./errors').JsonRpcError
var UnknownError = require('./errors').UnknownError

// ===================================================================

var nextId = 0

// -------------------------------------------------------------------

function setMessageType (message, type) {
  return Object.defineProperty(message, 'type', {
    configurable: true,
    value: type,
    writable: true
  })
}

// ===================================================================

function formatRequest (method, params, id) {
  return setMessageType({
    jsonrpc: '2.0',
    method: method,
    params: params || [],
    id: id || nextId++
  }, 'request')
}
exports.formatRequest = formatRequest

// -------------------------------------------------------------------

function formatNotification (method, params) {
  return setMessageType({
    jsonrpc: '2.0',
    method: method,
    params: params || []
  }, 'notification')
}
exports.formatNotification = formatNotification

// -------------------------------------------------------------------

function formatError (id, error) {
  // Hide internal errors.
  if (!(error instanceof JsonRpcError)) {
    // But log them because this should not happened!
    console.error(error && error.stack || error)

    error = new UnknownError()
  }

  return setMessageType({
    jsonrpc: '2.0',
    id: id,
    error: {
      code: error.code,
      message: error.message,
      data: error.data
    }
  }, 'error')
}
exports.formatError = formatError

// -------------------------------------------------------------------

function formatResponse (id, result) {
  return setMessageType({
    jsonrpc: '2.0',
    id: id,
    result: result
  }, 'response')
}
exports.formatResponse = formatResponse
