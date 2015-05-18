# json-rpc

> Easy to use [JSON-RPC 2](http://www.jsonrpc.org/specification) library

## Installation

Installation of the [npm package](https://npmjs.org/package/@julien-f/json-rpc):

```
> npm install --save @julien-f/json-rpc
```

> Because this is a [scoped package](https://docs.npmjs.com/getting-
> started/scoped-packages) you will need to have at least npm 2.7.0.

## Usage

1. [Peer](#peer)
2. [Errors](#errors)
3. [Parsing](#parsing)
4. [Formatting](#formatting)

### Peer

This library provides a high-level peer implementation which should
be flexible enough to use in any environments.

```javascript
// ES5
var createPeer = require('@julien/json-rpc').createPeer

// ES6
import {createPeer} from '@julien/json-rpc'
```

#### Construction

```javascript
var peer = createPeer(function onMessage (message) {
  // Here is the main handler where every incoming
  // notification/request message goes.
  //
  // For a request, this function just has to throw an exception or
  // return a value to send the related response.
  //
  // If the response is asynchronous, just return a promise.
})
```

> The `onMessage` parameter is optional, it can be omitted if this
> peer does not handle notifications and requests.

> Note: For security concerns, only exceptions which are instance of
> `JsonRpcError` will be transmitted to the remote peer, all others
> will be substituted by an instance of `UnknownError`.

#### Connection

> The peer is now almost ready, but before being usable, it has to be
> connected to the transport layer.

The simplest interface, the `exec()` method, has some limitations (no
notifications support) but is often good enough.

It is often used with non-connected protocols such as HTTP:

```javascript
var readAllSteam = require('read-all-stream')

// For this example we create an HTTP server:
require('http').createServer({
  port: 8081
}, function onRequest (req, res) {
  // Read the whole request body.
  readAllStream(req, function (err, data) {
    // Error handling would be better.
    if (err) return

    // Here `peer` is not used as a stream, it can therefore be used
    // to handle all the connections.
    peer.exec(message).then(function (response) {
      res.end(response)
    })
  })
})
```

If you have a connected transport, such as WebSocket, you may want to
use the stream interface: the peer is a duplex stream and can
therefore be connected to other streams via the `pipe()` method:

```javascript
// For this example, we create a WebSocket server:
require('websocket-stream').createServer({
  port: 8080
}, function onConnection (stream) {
  // Because a stream can only be used once, it is necessary to create
  // a dedicated peer per connection.
  stream.pipe(createPeer(onMessage)).pipe(stream)
})
```

#### Notification

```javascript
peer.notify('foo', ['bar'])
```

#### Request

The `request()` method returns a promise which will be resolved or
rejected when the response will be received.

```javascript
peer.request('add', [1, 2]).then(function (result) {
  console.log(result)
}).catch(function (error) {
  console.error(error.message)
})
```

#### Failure

Sometimes it is known that current pending requests will not get
answered (e.g. connection lost), it is therefore necessary to fail
them manually.

```javascript
peer.request('add', [1, 2]).catch(function (reason) {
  console.error(reason)
  // → connection lost
})

peer.failPendingRequests('connection lost');
```

### Errors

```javascript
// ES5
var errors = require('@julien-f/json-rpc/errors')
var JsonRpcError = errors.JsonRpcError
var InvalidJson = errors.InvalidJson
var InvalidRequest = errors.InvalidRequest
var MehtodNotFound = errors.MehtodNotFound
var InvalidParameters = errors.InvalidParameters

// ES6
import {
  JsonRpcError,
  InvalidJson,
  InvalidRequest,
  MethodNotFound,
  InvalidParameters
} from '@julien-f/json-rpc/errors'
```

This is the base error for all JSON-RPC errors:

```javascript
throw new JsonRpcError(message, code)
```

The JSON-RPC 2 specification defined also the following specialized
errors:

```javascript
// Parse error: invalid JSON was received by the peer.
throw new InvalidJson()

// Invalid request: the JSON sent is not a valid JSON-RPC 2 message.
throw new InvalidRequest()

// Method not found: the method does not exist or is not available.
throw new MethodNotFound(methodName)

// Invalid parameters.
throw new InvalidParameters(data)
```

Custom errors can of course be created, they just have to inherit
`JsonRpcError`:

```javascript
// ES5
function MyError () {
  JsonRpcError.call(this, 'my error', 1)
}
MyError.prototype = Object.create(JsonRpcError.prototype, {
  constructor: {
    value: MyError
  }
})

// ES6
class MyError extends JsonRpcError {
  constructor () {
    super('my error', 1)
  }
}
```

### Parsing

```javascript
// ES5
var parse = require('@julien-f/json-rpc/parse')

// ES6
import parse from '@julien/json-rpc/parse'
```

The `parse()` function parses, normalizes and validates JSON-RPC
messages.

These message can be either JS objects or JSON strings (they will be
parsed automatically).

This function may throws:

- `InvalidJson`: if the string cannot be parsed as a JSON;
- `InvalidRequest`: if the message is not a valid JSON-RPC message.

```javascript
parse('{"jsonrpc":"2.0", "method": "foo", "params": ["bar"]}')
// → {
//   [type: 'notification']
//   jsonrpc: '2.0',
//   method: 'foo',
//   params: ['bar']
// }

parse('{"jsonrpc":"2.0", "id": 0, "method": "add", "params": [1, 2]}')
// → {
//   [type: 'request']
//   jsonrpc: '2.0',
//   id: 0,
//   method: 'add',
//   params: [1, 2]
// }

parse('{"jsonrpc":"2.0", "id": 0, "result": 3}')
// → {
//   [type: 'response']
//   jsonrpc: '2.0',
//   id: 0,
//   result: 3
// }
```

> A parsed message has a non enumerable property `type` set to easily
> differentiate between types of JSON-RPC messages.

### Formatting

```javascript
// ES5
var format = require('@julien-f/json-rpc/format')

// ES6
import * as format from '@julien/json-rpc/format'
```

The `format.*()` functions can be used to create valid JSON-RPC
message in the form of JS objects. It is up to you to format them in
JSON if necessary.

#### Notification

```javascript
format.notification('foo', ['bars'])
// → {
//   [type: 'notification']
//   jsonrpc: '2.0',
//   method: 'foo',
//   params: ['bar']
// }
```

The last argument, the parameters of the notification is optional and
defaults to `[]`.

#### Request

The second argument, the parameters of the notification is optional and
defaults to `[]`.

The last argument, the identifier of the request is optional and is
generated if missing via an increment.

```javascript
format.request('add', [1, 2], 0)
// → {
//   [type: 'request']
//   jsonrpc: '2.0',
//   id: 0,
//   method: 'add',
//   params: [1, 2]
// }
```

#### Response

A successful response:

```javascript
format.response(0, 3)
// → {
//   [type: 'response']
//   jsonrpc: '2.0',
//   id: 0,
//   result: 3
// }
```

A failed response:

```javascript
var MethodNotFound = require('@julien-f/json-rpc/errors').MethodNotFound

format.error(0, new MethodNotFound('add'))
// → {
//   [type: 'error']
//   jsonrpc: '2.0',
//   id: 0,
//   error: {
//     code: -3601,
//     message: 'method not found: add',
//     data: 'add'
//   }
// }
```

Note: the error to format must be an instance of `JsonRpcError` or it
will be automatically replaced by an instance of `UnknownError` for
security reasons.

## Contributions

Contributions are *very* welcomed, either on the documentation or on
the code.

You may:

- report any [issue](https://github.com/julien-f/js-json-rpc/issues)
  you've encountered;
- fork and create a pull request.

## License

ISC © [Julien Fontanet](http://julien.isonoe.net)

