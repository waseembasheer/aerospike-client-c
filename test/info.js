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

/* global describe, it, context */

// we want to test the built aerospike module
require('../lib/aerospike')
const helper = require('./test_helper')
const expect = require('expect.js')

describe('client.info()', function () {
  var client = helper.client

  context('querying a single node', function () {
    var hosts = client.config.hosts

    it('should fetch object count from specific cluster node and pass it to the info callback', function (done) {
      var host = hosts[0]
      client.info('objects', host, function (err, response, responding_host) {
        expect(err).not.to.be.ok()
        expect(responding_host).to.eql(host)
        expect(response.indexOf('objects\t')).to.eql(0)
        done()
      })
    })
  })

  context('querying all the nodes', function () {
    var nodes_count = client.config.hosts.length

    it('should fetch object count from all cluster nodes', function (done) {
      var responses = 0
      client.info('objects', function (err, response, host) {
        responses++
        expect(err).not.to.be.ok()
        expect(response.indexOf('objects')).to.eql(0)
        if (responses === nodes_count) done()
      })
    })
  })

  it('should call the done callback after the info callback', function (done) {
    var info_cb_called = 0
    client.info(function () {
      info_cb_called += 1
    }, function () {
      expect(info_cb_called).to.not.eql(0)
      done()
    })
  })
})
