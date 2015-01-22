'use strict';

//====================================================================

require('bluebird').longStackTraces();

var http = require('http');

var parseJsonStream = require('ldjson-stream').parse;
var serializeJsonStream = require('ldjson-stream').serialize;
var combineStreams = require('stream-combiner');

var JsonRpc = require('../');
var MethodNotFound = require('../errors').MethodNotFound;

var PORT = 36914;

//====================================================================

var jsonRpc = JsonRpc.createServer(function onMessage(message) {
  if (message.type === 'notification') {
    return console.log('notification:', message);
  }

  if (message.method === 'bar') {
    console.log('bar called');

    return true;
  }

  throw new MethodNotFound();
});

http.createServer(function (req, res) {
  combineStreams([
    // Read from the request.
    req,

    // Parse line-delimited JSON messages.
    parseJsonStream(),

    // Handle JSON-RPC requests.
    jsonRpc,

    // Format as line-delimited JSON messages.
    serializeJsonStream(),

    // Send to the response.
    res,
  ]);
}).listen(PORT);

//====================================================================

require('http').request({
  method: 'POST',
  port: PORT,
}, function (res) {
  res.pipe(process.stdout);
}).end(JSON.stringify([
  {
    jsonrpc: '2.0',
    method: 'foo',
  },
  {
    jsonrpc: '2.0',
    method: 'bar',
    id: 0,
  },
  {
    jsonrpc: '2.0',
    method: 'baz',
    id: 1,
  },
]));
