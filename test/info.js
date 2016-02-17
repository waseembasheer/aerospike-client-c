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
const aerospike = require('../lib/aerospike')
const helper = require('./test_helper')
const expect = require('expect.js')

const status = aerospike.status

describe('client.info()', function () {
  var client = helper.client
  var hosts = client.config.hosts

  it('should get "objects" from all hosts in cluster', function (done) {
    var responses = 0
    client.info('objects', function (err, response, host) {
      responses++
      expect(err).to.be.ok()
      expect(err.code).to.equal(status.AEROSPIKE_OK)
      expect(response.indexOf('objects')).to.eql(0)
      if (responses === hosts.length) done()
    })
  })

  it('should get "objects" from specific host in cluster', function (done) {
    var host = hosts[0]
    client.info('objects', host, function (err, response, responding_host) {
      expect(err).to.be.ok()
      expect(err.code).to.equal(status.AEROSPIKE_OK)
      expect(responding_host).to.eql(host)
      expect(response.indexOf('objects\t')).to.eql(0)
      done()
    })
  })
})
