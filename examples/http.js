'use strict';

//====================================================================

require('bluebird').longStackTraces();

var createHttp = require('http').createServer;

var parseJsonStream = require('ldjson-stream').parse;
var serializeJsonStream = require('ldjson-stream').serialize;
var combineStreams = require('stream-combiner');

var createJsonRpc = require('../').create;
var MethodNotFound = require('../errors').MethodNotFound;

var PORT = 36914;

//====================================================================

var http = createHttp().listen(PORT);

var jsonRpc = createJsonRpc(function onMessage(message) {
  if (message.type === 'notification') {
    return console.log('notification:', message);
  }

  if (message.method === 'bar') {
    console.log('bar called');

    return true;
  }

  throw new MethodNotFound();
});

http.on('request', function (req, res) {
  combineStreams([
    req,
    parseJsonStream(),
    jsonRpc.stream(),
    serializeJsonStream(),
    res,
  ]);
});

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
