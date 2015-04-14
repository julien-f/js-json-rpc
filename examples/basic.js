'use strict'

// ===================================================================

require('bluebird').longStackTraces()

var delay = require('bluebird').delay

var jsonRpc = require('../')
var MethodNotFound = require('../errors').MethodNotFound

// ===================================================================

// For the purpose of this example, two peers are going to be created
// and connected to each other.
var peer1, peer2

peer1 = jsonRpc.createServer(function (message) {
  if (message.type === 'notification') {
    return console.log('notif to peer1: %s(%j)',
      message.method,
      message.params
    )
  }

  throw new MethodNotFound()
})

peer2 = jsonRpc.createServer(function (message) {
  if (message.type === 'notification') {
    return console.log('notif to peer2: %s%j',
      message.method,
      message.params
    )
  }

  if (message.method === 'add') {
    var sum = 0
    message.params.forEach(function (value) {
      sum += value
    })

    // The result can be returned directly be it can also be a
    // promise like here.
    return delay(sum, 1e3)
  }

  throw new MethodNotFound()
})

// Connect peer1 and peer2.
peer1.pipe(peer2).pipe(peer1)

// Peer 1 sends a notification to peer 2.
peer1.notify('foo', ['bar', 'baz'])

// Peer 1 request peer 2 to do an addition.
peer1.request('add', [3.14, 6.28]).then(function (sum) {
  console.log('the sum is %s', sum)
})

// Peer 2 request peer 1 to do an addition but the method is not
// defined.
peer2.request('add', [2.72, 42]).catch(function (error) {
  console.error('the sum failed: %j', error)
})
