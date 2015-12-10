/*******************************************************************************
 * Copyright 2013-2014 Aerospike, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/

// we want to test the built aerospike module
var aerospike = require('../lib/aerospike');
var options = require('./util/options');
var assert = require('assert');
var expect = require('expect.js');

var keygen = require('./generators/key');
var metagen = require('./generators/metadata');
var valuegen = require('./generators/value');
var recgen = require('./generators/record');

var status = aerospike.status;
var policy = aerospike.policy;
var op = aerospike.operator;

describe('client.operate()', function() {

    var config = options.getConfig();
    var client = aerospike.client(config);

    before(function(done) {
        client.connect(function(err){
            done();
        });
    });

    after(function(done) {
        client.close();
        client = null;
        done();
    });

    it('should get the array value at the specified index', function(done) {

        // generators
        var kgen = keygen.string(options.namespace, options.set, {prefix: "test/cdt/get/"});
        var mgen = metagen.constant({ttl: 1000});
        var agen = valuegen.array();
        var rgen = recgen.record({list: agen});

        // values
        var key     = kgen();
        var meta    = mgen(key);
        var record  = rgen(key, meta);

        // write the record then check
        client.put(key, record, meta, function(err, key) {

            var ops = [
                op.list_get('list', 1)
            ];

            client.operate(key, ops, function(err, record1, metadata1, key1) {
                expect(err).to.be.ok();
                expect(err.code).to.equal(status.AEROSPIKE_OK);

                expect(record1.list).to.equal(record.list[1]);
                client.remove(key1, function(err, key){
                    done();
                });
            });
        });
    });

});