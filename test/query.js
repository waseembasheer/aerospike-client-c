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
var aerospike = require('../lib/aerospike')
var options = require('./util/options');
var assert = require('assert');
var expect = require('expect.js');


var keygen  = require('./generators/key');
var metagen = require('./generators/metadata');
var recgen  = require('./generators/record');
var putgen  = require('./generators/put');
var valgen  = require('./generators/value');

var status     = aerospike.status;
var policy	   = aerospike.policy;
var scanStatus = aerospike.scanStatus;
var filter	   = aerospike.filter;

describe('client.query()', function() {

    var config = options.getConfig();
    config.modlua = {};
    config.modlua.userPath = __dirname;
    var client = aerospike.client(config);

    before(function(done) {
        client.connect(function(err){

            var indexCreationCallback  = function(err){
                expect(err.code).to.equal(status.AEROSPIKE_OK);
            }
            // create integer and string index.
            var indexObj = {
                ns: options.namespace,
                set: options.set,
                bin: 'queryBinInt',
                index: 'queryIndexInt'
            }
            client.createIntegerIndex(indexObj, indexCreationCallback);

            indexObj = {
                ns: options.namespace,
                set: options.set,
                bin: 'queryBinString',
                index: 'queryIndexString'
            }
            client.createStringIndex(indexObj, indexCreationCallback);

            // Register the UDFs to be used in aggregation.

            var dir = __dirname;
            var filename = dir + "/aggregate.lua"
            client.udfRegister(filename, function(err) {
                expect(err).to.be.ok();
                expect(err.code).to.equal(status.AEROSPIKE_OK);
            }); 


            // load objects - to be queried in test case. 
            var total = 100;
            var count = 0;

            function iteration(i) {

                // values
                var key     = { ns: options.namespace, set: options.set, key: "test/query" + i.toString()}
                var meta    = { ttl: 10000, gen: 1}
                var record  = { queryBinInt: i, queryBinString: 'querystringvalue'}

                // write the record then check
                client.put(key, record, meta, function(err, key) {
                    client.get(key, function(err, _record, _metadata, _key) {

                        expect(err).to.be.ok();
                        expect(err.code).to.equal(status.AEROSPIKE_OK);
                        count++;
                        if ( count >= total ) {
                            done();
                        }
                    });
                });
            }

            for ( var i = 1; i <= total; i++ ) {
                iteration(i);
            }

        });

    });

    after(function(done) {
        client.close();
        client = null;
        done();
    });

    it('should query on an integer index - filter by equality of bin value', function(done) {

        // counters
        var total = 100;
        var count = 0;
        var err = 0;

        var args = { filters: [filter.equal('queryBinInt', 100)] }
        var query = client.query(options.namespace, options.set, args);

        var stream = query.execute();
        stream.on('data', function(rec){
            expect(rec.bins).to.have.property('queryBinInt');
            expect(rec.bins).to.have.property('queryBinString');
            expect(rec.bins['queryBinInt']).to.equal(100);
            count++;
        });
        stream.on('error', function(error){
            err++;
        });
        stream.on('end', function(end){
            expect(count).to.be.equal(1);
            expect(err).to.equal(0);
            done();
        });
    });
    it('should query on an integer index - filter by range of bin values', function(done) {

        // counters
        var total = 100;
        var count = 0;
        var err = 0;

        var args = { filters: [filter.range('queryBinInt', 1, 100)] }
        var query = client.query(options.namespace, options.set, args);

        var stream = query.execute();
        stream.on('data', function(rec){
            expect(rec.bins).to.have.property('queryBinInt');
            expect(rec.bins).to.have.property('queryBinString');
            expect(rec.bins['queryBinInt']).to.be.lessThan(101);
            count++;
        });
        stream.on('error', function(error){
            err++;
        });
        stream.on('end', function(end){
            expect(count).to.be.greaterThan(total-1);
            expect(err).to.equal(0);
            done();
        });
    });
    it('should query on a string index - filter by equality of bin value', function(done) {

        // counters
        var total = 100;
        var count = 0;
        var err = 0;

        var args = { filters: [filter.equal('queryBinString', 'querystringvalue')] }
        var query = client.query(options.namespace, options.set, args);

        var stream = query.execute();
        stream.on('data', function(rec){
            expect(rec.bins).to.have.property('queryBinInt');
            expect(rec.bins).to.have.property('queryBinString');
            expect(rec.bins['queryBinString']).to.equal('querystringvalue');
            count++;
        });
        stream.on('error', function(error){
            err++;
        });
        stream.on('end', function(end){
            expect(count).to.be.greaterThan(total-1);
            expect(err).to.equal(0);

            done();
        });
    });

    it('should query on an index and apply aggregation user defined function', function(done) {

        if( !options.run_aggregation ) {
            done();
        }
        else {
            // counters
            var total = 100;
            var count = 0;
            var err = 0;

            var args = { filters: [filter.equal('queryBinString', 'querystringvalue')],
                aggregationUDF: {module:'aggregate', funcname:'sum_test_bin'}}
            var query = client.query(options.namespace, options.set, args);

            var stream = query.execute();
            stream.on('data', function(result){
                expect(result).to.be.ok();
                count++;
            });
            stream.on('error', function(error){
                expect(error).to.be.ok();
                expect(error.code).to.equal(status.AEROSPIKE_OK);
                err++;
            });
            stream.on('end', function(end){
                expect(count).to.be.equal(1);
                expect(err).to.equal(0);
                done();
            });
        }
    });
    it.skip('should scan aerospike database and apply aggregation user defined function', function(done) {

        if( !options.run_aggregation ) {
            done();
        }
        else {
            // counters
            var total = 100;
            var count = 0;
            var err = 0;

            var args = { aggregationUDF: {module:'aggregate', funcname:'sum_test_bin'}}
            var query = client.query(options.namespace, options.set, args);

            var stream = query.execute();
            stream.on('data', function(result){
                expect(result).to.be.ok();
                count++;
            });
            stream.on('error', function(error){
                expect(error).to.be.ok();
                expect(error.code).to.equal(status.AEROSPIKE_OK);
                err++;
            });
            stream.on('end', function(end){
                expect(count).to.be.equal(1);
                expect(err).to.equal(0);
                done();
            });
        }
    });

});
