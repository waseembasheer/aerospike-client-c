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
const Aerospike = require('../lib/aerospike')
const helper = require('./test_helper')
const expect = require('expect.js')

const keygen = helper.keygen
const metagen = helper.metagen
const recgen = helper.recgen

const status = Aerospike.status
const policy = Aerospike.policy

describe('client.get()', function () {
  var client = helper.client

  it('should read the record', function (done) {
    // generators
    var kgen = keygen.string(helper.namespace, helper.set, {prefix: 'test/get/'})
    var mgen = metagen.constant({ttl: 1000})
    var rgen = recgen.constant({i: 123, s: 'abc'})

    // values
    var key = kgen()
    var meta = mgen(key)
    var record = rgen(key, meta)

    // write the record then check
    client.put(key, record, meta, function (err, key) {
      if (err) { throw new Error(err.message) }
      client.get(key, function (err, record, metadata, key) {
        expect(err).not.to.be.ok()
        client.remove(key, function (err, key) {
          if (err) { throw new Error(err.message) }
          done()
        })
      })
    })
  })

  it('should not find the record', function (done) {
    // generators
    var kgen = keygen.string(helper.namespace, helper.set, {prefix: 'test/not_found/'})

    // values
    var key = kgen()

    // write the record then check
    client.get(key, function (err, record, metadata, key) {
      expect(err).to.be.ok()
      if (err.code !== 602) {
        expect(err.code).to.equal(status.AEROSPIKE_ERR_RECORD_NOT_FOUND)
      } else {
        expect(err.code).to.equal(602)
      }
      done()
    })
  })

  it('should read the record w/ a key send policy', function (done) {
    // generators
    var kgen = keygen.string(helper.namespace, helper.set, {prefix: 'test/get/'})
    var mgen = metagen.constant({ttl: 1000})
    var rgen = recgen.constant({i: 123, s: 'abc'})

    // values
    var key = kgen()
    var meta = mgen(key)
    var record = rgen(key, meta)
    var pol = { key: policy.key.SEND }

    // write the record then check
    client.put(key, record, meta, function (err, key) {
      if (err) { throw new Error(err.message) }
      client.get(key, pol, function (err, record, metadata, key) {
        expect(err).not.to.be.ok()
        client.remove(key, function (err, key) {
          if (err) { throw new Error(err.message) }
          done()
        })
      })
    })
  })
})
