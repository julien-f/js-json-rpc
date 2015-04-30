'use strict'

// ===================================================================

var has = require('lodash.has')
var isArray = require('lodash.isarray')
var isNull = require('lodash.isnull')
var isNumber = require('lodash.isnumber')
var isObject = require('lodash.isobject')
var isString = require('lodash.isstring')
var isUndefined = require('lodash.isundefined')
var map = require('lodash.map')

var InvalidJson = require('./errors').InvalidJson
var InvalidRequest = require('./errors').InvalidRequest

// ===================================================================

function isInteger (value) {
  return isNumber(value) && (value % 1 === 0)
}

function setMessageType (message, type) {
  Object.defineProperty(message, 'type', {
    configurable: true,
    value: type,
    writable: true
  })
}

function xor (a, b) {
  return (!a !== !b)
}

// ===================================================================

// Parses, normalizes and validates a JSON-RPC message.
//
// The returns value is an object containing the normalized fields of
// the JSON-RPC message and an additional `type` field which contains
// one of the following: `notification`, request` or `response`.
function parse (message) {
  if (isString(message)) {
    try {
      message = JSON.parse(message)
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new InvalidJson()
      }

      throw error
    }
  }

  // Properly handle array of requests.
  if (isArray(message)) {
    return map(message, parse)
  }

  if (message.jsonrpc !== '2.0') {
    // Use the same errors for all JSON-RPC messages (requests,
    // responses and notifications).
    throw new InvalidRequest()
  }

  if (isString(message.method)) {
    // Notification or request.

    var params = message.params
    if (
      !isUndefined(params) &&
      !isArray(params) &&
      !isObject(params)
    ) {
      throw new InvalidRequest()
    }

    var id = message.id
    if (isUndefined(id)) {
      setMessageType(message, 'notification')
    } else if (
      isNull(id) ||
      isNumber(id) ||
      isString(id)
    ) {
      setMessageType(message, 'request')
    } else {
      throw new InvalidRequest()
    }
  } else {
    // Response.

    var error
    if (!xor(
      has(message, 'result'),
      (
        has(message, 'error') &&
        isInteger((error = message.error).code) &&
        isString(error.message)
      )
    )) {
      throw new InvalidRequest()
    }

    setMessageType(message, 'response')
  }

  return message
}
module.exports = parse

// ===================================================================

// Ensure maximum import compatibility with Babel.
Object.defineProperty(exports, '__esModule', {
  value: true
})
