// *****************************************************************************
// Copyright 2013-2016 Aerospike, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License")
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// *****************************************************************************

/* global describe, it */

// we want to test the built aerospike module
var aerospike = require('../build/Release/aerospike')
var options = require('./util/options')
var expect = require('expect.js')
var fs = require('fs')

var status = aerospike.status

describe('client.updateLogging()', function () {
  var config = options.getConfig()
  config.log.file = null

  it('should log the messages to test.log', function (done) {
    var host = {addr: options.host, port: options.port}
    var count = 0
    fs.open('test.log', 'a', function (err, fd) {
      if (err && err.code !== status.AEROSPIKE_OK) { throw new Error(err.message) }
      config.log.file = fd
      aerospike.client(config).connect(function (err, client) {
        if (err && err.code !== status.AEROSPIKE_OK) { throw new Error(err.message) }
        client.info('objects', host, function (err, response, host) {
          expect(err).to.be.ok()
          expect(err.code).to.equal(status.AEROSPIKE_OK)
          count++
          fs.readFile('test.log', function (err, data) {
            if (err && err.code !== status.AEROSPIKE_OK) { throw new Error(err.message) }
            expect(data).to.be.ok()
            done()
          })
        })
      })
    })
  })
})
