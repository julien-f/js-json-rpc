'use strict'

// ===================================================================

require('bluebird').longStackTraces()

var http = require('http')

var readAllStream = require('read-all-stream')

var JsonRpc = require('../')
var MethodNotFound = require('../errors').MethodNotFound

var PORT = 36914

// ===================================================================

var httpServer = http.createServer().listen(PORT)

var server = JsonRpc.createPeer(function onMessage (message) {
  if (message.type === 'notification') {
    return console.log('notification:', message)
  }

  if (message.method === 'bar') {
    console.log('bar()')

    return 'result of bar()'
  }

  if (message.method === 'closeServer') {
    console.log('closeServer()')

    httpServer.close()
    return true
  }

  throw new MethodNotFound()
})

// Connect the HTTP server to the JSON-RPC server.
httpServer.on('request', function (req, res) {
  readAllStream(req, function (err, data) {
    // Error handling would be better.
    if (err) return

    server.exec(data).then(function (response) {
      // Only some requests have (non empty) responses.
      if (response) res.write(JSON.stringify(response))

      res.end()
    })
  })
})

// ===================================================================

var client = JsonRpc.createPeer()

// Connect the JSON-RPC client to HTTP.
client.on('data', function (data) {
  http.request({ method: 'POST', port: PORT }, function (res) {
    readAllStream(res, function (err, data) {
      // Error handling would be better.
      if (err) return

      // Only some requests have (non empty) responses.
      if (data) client.write(data)
    })
  }).end(JSON.stringify(data))
})

client.notify('foo')
client.request('bar').then(console.log)
client.request('baz').catch(console.error)

setTimeout(function () {
  client.request('closeServer')
}, 1e3)
