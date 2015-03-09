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
var recgen = require('./generators/record');
var putgen = require('./generators/put');
var valgen = require('./generators/value');

var status = aerospike.status;
var policy = aerospike.policy;
var language = aerospike.language;


describe('client.LargeList()', function(done) {

    var config = {
        hosts: [
            { addr: options.host, port: options.port }
        ],
        log: {
            level: options.log,
			file: options.log_file
        },
        policies: {
            timeout: options.timeout
        }
    };
	var client = aerospike.client(config);
	// A single LList is created. All LList operations are done in this single list to demonstrate the 
	// usage of LList API.
	// The operations include adding an element, udpating an element, searching for an element
	// and removing an element.
	// Get a largelist object from client.
	var listkey = {ns: options.namespace, set: options.set, key: "ldt_list_key"}
	var writepolicy = { timeout: 1000, key: policy.key.SEND, commitLevel: policy.commitLevel.ALL};
	var LList = client.LargeList(listkey, "ldt_list_bin", writepolicy);

    before(function(done) {
		client.connect(function(err){
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			done();
		});
    });

    after(function(done) {
		// LList used in this test case is destructed here. The list will not be available after destroying
		// the list.
		LList.destroy(function(err, val) {
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			client.close();
			client = null;
			done();
		});

    });

	it('should add an element of type integer to the LList ', function(done) {
		var igen = valgen.integer();
		var listval  = igen();
		var intval = {"key":"intvalue", "value": listval}
		// insert an integer value into the list.
		LList.add(intval, function(err, retVal){
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			//verify the inserted element in the list.
			LList.find({"key":"intvalue"}, function(err, val) {
				expect(err).to.be.ok();
				expect(err.code).to.equal(status.AEROSPIKE_OK);
				expect(val[0].value).to.equal(listval);
				done();
			});
		});
	});
	it('should add an element of type string to the LList ', function(done) {
		var sgen = valgen.string();
		var listval =  sgen();
		var strval = {"key": "stringvalue", "value" : listval};
		// insert an string value into the list.
		LList.add(strval, function(err, retVal){
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			//verify the inserted element in the list.
			LList.find({"key":"stringvalue"}, function(err, val) {
				expect(err).to.be.ok();
				expect(err.code).to.equal(status.AEROSPIKE_OK);
				expect(val[0].value).to.equal(listval);
				done();
			});
		});
	});
	it('should add an element of type bytes to the LList ', function(done) {
		var bgen = valgen.bytes();
		var listval =  bgen();
		var bytesval = {"key": "bytesvalue", "value" : listval};
		// insert a byte value into the list.
		LList.add(bytesval, function(err, retVal){
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			//verify the inserted element in the list.
			LList.find({"key":"bytesvalue"}, function(err, val) {
				expect(err).to.be.ok();
				expect(err.code).to.equal(status.AEROSPIKE_OK);
				expect(val[0].value).to.eql(listval);
				done();
			});
		});
	});
	it('should add an element of type array to the LList ', function(done) {
		var agen = valgen.array();
		var listval =  agen();
		var bytesval = {"key": "arrayvalue", "value" : listval};
		// insert an array element into the list.
		LList.add(bytesval, function(err, retVal){
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			//verify the inserted element in the list.
			LList.find({"key":"arrayvalue"}, function(err, val) {
				expect(err).to.be.ok();
				expect(err.code).to.equal(status.AEROSPIKE_OK);
				expect(val[0].value).to.eql(listval);
				done();
			});
		});
	});
	it('should add an element of type map to the LList ', function(done) {
		var mgen    = valgen.map();
		var listval =  mgen();
		var mapval  = {"key": "mapvalue", "value" : listval};
		// insert a map element into the list.
		LList.add(mapval, function(err, retVal){
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			//verify the inserted element in the list.
			LList.find({"key":"mapvalue"}, function(err, val) {
				expect(err).to.be.ok();
				expect(err.code).to.equal(status.AEROSPIKE_OK);
				expect(val[0].value).to.eql(listval);
				done();
			});
		});
	});
	it('should add an array of values to LList ', function(done) {
		var mgen       = valgen.map();
		var agen	   = valgen.array();
		var igen       = valgen.integer();
		var sgen       = valgen.string();
		var bgen       = valgen.bytes();

		// array of values to be inserted into the LList.
		var valList    = [ bgen(), igen(), agen(), mgen(), sgen()]

		var bytesval   = {"key": "arraybytesvalue", "value" : valList[0]}
		var integerval = {"key":"arrayintvalue",    "value" : valList[1]}
		var arrayval   = {"key": "arraylistvalue",  "value" : valList[2]}
		var mapval     = {"key": "arraymapvalue",   "value" : valList[3]} 
		var stringval  = {"key": "arraystrvalue",	"value" : valList[4]}
		
		// array of values with key to be inserted into the LList.
		var arrayList  = [ mapval, arrayval, bytesval, stringval, integerval];
		LList.add(arrayList, function(err, retVal){
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			//verify the inserted element in the list.
			LList.findRange("arraybytesvalue", "arraystrvalue", function(err, val) {
				expect(err).to.be.ok();
				expect(err.code).to.equal(status.AEROSPIKE_OK);
				expect(val[0].value).to.eql(valList[0]);
				expect(val[1].value).to.equal(valList[1]);
				expect(val[2].value).to.eql(valList[2]);
				expect(val[3].value).to.eql(valList[3]);
				expect(val[4].value).to.equal(valList[4]);
				done();
			});
		});
	});
	it('should verify that passing wrong number of arguments to add API fails gracefully', function(done) {
		var igen = valgen.integer();
		var listval  = igen();
		var intval = {"key":"intvalue", "value": listval}
		LList.add(intval, undefined, function(err, retVal){
			expect(err).to.be.ok();
			expect(err.func).to.equal('add ');
			done();
		});
	});

	it('should update an element in the LList ', function(done) {
		var igen = valgen.integer();
		var listval  = igen();
		var intval = {"key":"intvalue", "value": listval}
		// update an integer value in the list.
		LList.update(intval, function(err, retVal){
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			//verify the updated element in the list.
			LList.find({"key":"intvalue"}, function(err, val) {
				expect(err).to.be.ok();
				expect(err.code).to.equal(status.AEROSPIKE_OK);
				expect(val[0].value).to.equal(listval);
				done();
			});
		});
	});
	it('should update an array of values in the LList ', function(done) {
		var mgen       = valgen.map();
		var agen	   = valgen.array();
		var igen       = valgen.integer();
		var sgen       = valgen.string();
		var bgen       = valgen.bytes();
		var valList    = [ bgen(), igen(), agen(), mgen(), sgen()]

		var bytesval   = {"key": "arraybytesvalue", "value" : valList[0]}
		var integerval = {"key":"arrayintvalue",    "value" : valList[1]}
		var arrayval   = {"key": "arraylistvalue",  "value" : valList[2]}
		var mapval     = {"key": "arraymapvalue",   "value" : valList[3]} 
		var stringval  = {"key": "arraystrvalue",	"value" : valList[4]}
	
		var arrayList  = [ mapval, arrayval, bytesval, stringval, integerval];

		//update an array of elements in the list.
		LList.update(arrayList, function(err, retVal){
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			//verify the updated elements in the list.
			LList.findRange("arraybytesvalue", "arraystrvalue", function(err, val) {
				expect(err).to.be.ok();
				expect(err.code).to.equal(status.AEROSPIKE_OK);
				expect(val[0].value).to.eql(valList[0]);
				expect(val[1].value).to.equal(valList[1]);
				expect(val[2].value).to.eql(valList[2]);
				expect(val[3].value).to.eql(valList[3]);
				expect(val[4].value).to.equal(valList[4]);
				done();
			});
		});
	});
	it('should verify that passing wrong number of arguments to update API fails gracefully', function(done) {
		var igen = valgen.integer();
		var listval  = igen();
		var intval = {"key":"intvalue", "value": listval}
		LList.update(intval, undefined, function(err, retVal){
			expect(err).to.be.ok();
			expect(err.func).to.equal('update ');
			done();
		});
	});

	it('should verify the find API of LList -finds an existing element', function(done) {
		//find an element in the list.
		LList.find({"key":"intvalue"}, function(err, val) {
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			expect(val[0]).to.have.property('value');
			done();
		});
	});
	it('should verify the find API of LList -finds a non-existing element and fails', function(done) {
		//find an element in the list.
		LList.find({"key":"novalue"}, function(err, val) {
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_ERR_LDT_NOT_FOUND);
			done();
		});
	})

	it('should verify the range API of LList- expected to find existing elements', function(done) {
		
		LList.findRange("arraybytesvalue", "arraystrvalue", function(err, val) {
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			expect(val.length).to.equal(5);
			done();
		});
	});
	it('should verify the range API of LList- expected to not find any elements', function(done) {
		
		LList.findRange("zbytesvalue", "zstrvalue", function(err, val) {
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			expect(val.length).to.eql(0);
			done();
		});
	});
	it('should verify the size API of LList ', function(done) {
		
		LList.size(function(err, val) {
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			expect(val).to.equal(10);
			done();
		});
	});
	it('should verify that size API fails gracefully when passing wrong number of arguments', function(done) {
		
		LList.size(2, function(err, val) {
			expect(err).to.be.ok();
			expect(err.func).to.equal('size ');
			done();
		});
	});
	it('should verify the getCapacity and setCapacity API of LList ', function(done) {
	
		var capacity = 25;
		LList.setCapacity(capacity, function(err, val) {
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			LList.getCapacity(function(err, val) {
				expect(err).to.be.ok();
				expect(err.code).to.equal(status.AEROSPIKE_OK);
				expect(val).to.equal(capacity);
				done();
			});
		});
	});
	it('should verify the getCapacity and setCapacity API fails gracefully when wrong number of arguments are passed', function(done) {
	
		var capacity = 25;
		LList.setCapacity(capacity, 24, function(err, val) {
			expect(err).to.be.ok();
			expect(err.func).to.equal('setCapacity ');
			LList.getCapacity(3, function(err, val) {
				expect(err).to.be.ok();
				expect(err.func).to.equal('getCapacity ');
				done();
			});
		});
	});

	it('should verify the scan API of LList ', function(done) {
		
		LList.scan(function(err, val) {
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			expect(val.length).to.equal(10);
			done();
		});
	});
	it('should verify the scan API fails gracefully when wrong number of arguments are passed', function(done) {
		
		LList.scan("scan", function(err, val) {
			expect(err).to.be.ok();
			expect(err.func).to.equal('scan ');
			done();
		});
	});

	it('should remove an element from the LList ', function(done) {
		var intval = {"key":"intvalue"}
		// remove the integer value into the list.
		LList.remove(intval, function(err, retVal){
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			//verify the removed element in the list.
			LList.find({"key":"intvalue"}, function(err, val) {
				expect(err).to.be.ok();
				expect(err.code).to.equal(status.AEROSPIKE_ERR_LDT_NOT_FOUND);
				LList.size(function(err, val){
					expect(err).to.be.ok();
					expect(err.code).to.equal(status.AEROSPIKE_OK);
					expect(val).to.equal(9);
					done();
				});
			});
		});
	});
	it('should remove an array of elements from LList ', function(done) {
		var bytesval   = {"key": "bytesvalue"}
		var stringval  = {"key":"stringvalue"}
		var arrayval   = {"key": "arrayvalue"}
		var mapval     = {"key": "mapvalue" } 
	
		// remove an array of elements from the list.
		var arrayList  = [ mapval, arrayval, bytesval, stringval ];
		LList.remove(arrayList, function(err, retVal){
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			LList.size(function(err, val){
				expect(err).to.be.ok();
				expect(err.code).to.equal(status.AEROSPIKE_OK);
				expect(val).to.equal(5);
				done();
			})
		});
	});
	it('should verify remove API fails when invalid number of arguments are passed', function(done) {
	
		// remove an array of elements from the list.
		LList.remove("list", 123, function(err, retVal){
			expect(err).to.be.ok();
			expect(err.func).to.equal('remove ');
			done();
		});
	});

	it('should verify removing a range of values in LList ', function(done) {
		LList.removeRange("arraybytesvalue", "arraystrvalue", function(err, retVal){
			expect(err).to.be.ok();
			expect(err.code).to.equal(status.AEROSPIKE_OK);
			LList.findRange("arraybytesvalue", "arraystrvalue", function(err, val) {
				expect(err).to.be.ok();
				expect(err.code).to.equal(status.AEROSPIKE_OK);
				expect(val.length).to.equal(0);
				LList.size(function(err, val){
					expect(err).to.be.ok();
					expect(err.code).to.be.equal(status.AEROSPIKE_OK);
					expect(val).to.equal(0);
					done();
				});
			});
		});
	});
	it('should verify removeRange API fails when invalid number of arguments are passed', function(done) {
	
		LList.removeRange("list", 123, 345, function(err, retVal){
			expect(err).to.be.ok();
			expect(err.func).to.equal('removeRange ');
			done();
		});
	});

});
