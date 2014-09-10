// ISC @ Julien Fontanet
//
// https://gist.github.com/julien-f/26daf1aa567e68bfa7fe

'use strict';

//====================================================================

function makeError(constructor, super_) {
  super_ || (super_ = Error);

  constructor.super = (super_ === Error) ?
    function (message) {
      this.message = message;

      Error.captureStackTrace(this, this.constructor);
    } :
    super_
  ;

  var p = constructor.prototype = Object.create(super_.prototype);
  p.constructor = constructor;
  p.name = constructor.name;
}
exports = module.exports = makeError;
