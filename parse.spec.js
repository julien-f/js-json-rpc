'use strict'

/* eslint-env mocha */

// ===================================================================

var parse = require('./parse')

// ===================================================================

var expect = require('chai').expect

var errors = require('./errors')

// ===================================================================

describe('parse()', function () {
  it('throws on invalid JSON', function () {
    expect(function () {
      parse('')
    }).to.throw(errors.InvalidJson)
  })

  it('throws on invalid JSON-RPC', function () {
    expect(function () {
      parse({})
    }).to.throw(errors.InvalidRequest)
  })

  it('handles notification', function () {
    var notif = parse({
      jsonrpc: '2.0',
      method: 'foo'
    })

    expect(notif.type).to.equal('notification')
  })

  it('handles request', function () {
    var notif = parse({
      jsonrpc: '2.0',
      id: 0,
      method: 'bar'
    })

    expect(notif.type).to.equal('request')
  })

  it('handles successful response', function () {
    var notif = parse({
      jsonrpc: '2.0',
      id: 0,
      result: 'baz'
    })

    expect(notif.type).to.equal('response')
  })

  it('handles failed response', function () {
    var notif = parse({
      jsonrpc: '2.0',
      id: 0,
      error: {
        code: 0,
        message: ''
      }
    })

    expect(notif.type).to.equal('response')
  })
})
