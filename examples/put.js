var aerospike = require('aerospike');
var assert = require('assert');
var msgpack = require('msgpack');
var sleep = require('sleep');

var status = aerospike.Status;
var policy = aerospike.Policy;
var config = {
	  hosts:[{ addr:"127.0.0.1",port : 3000 }
		]}
var client = aerospike.connect(config);

var n = process.argv.length >= 3 ? parseInt(process.argv[2]) :14000
var m = 0

console.time(n + " put")
for (var i = 1; i <= n; i++ ) {

  var str = "This is abnormally lengthy string. This is to test batch_get functioning for more than 8 bytes";
  var o = {"a" : 1, "b" : 2, "c" : [1, 2, 3],"d": str};
  // pack the object o using msgpack
  var pbuf = msgpack.pack(o);
  var k1 = {'ns':"test", 'set':"demo", 'key':"value" + i }
 
  var binlist = { "s": i.toString(),"i" : i, "b": pbuf}
  var rec = {ttl: 10000, gen: 0, bins: binlist}

  var write_policy = {timeout : 10, 
					  Retry: policy.RetryPolicy.AS_POLICY_RETRY_ONCE, 
					  Key: policy.KeyPolicy.AS_POLICY_KEY_SEND, 
					  Gen: policy.GenerationPolicy.AS_POLICY_GEN_EQ,
					  Exists: policy.ExistsPolicy.AS_POLICY_EXISTS_IGNORE }

  client.put(k1, rec, write_policy, function(err) {
    if ( err.code != status.AEROSPIKE_OK ) {
      console.log("error: %s", err.message);
    }
    if ( (++m) == n ) {
      //console.timeEnd(n + " put")
	  //client.close();
    }
  });
  var readpolicy = { timeout : 10, Key : policy.KeyPolicy.AS_POLICY_KEY_SEND }
  client.get(k1, function(err,bins,meta) {
	console.log(meta);
	console.log(bins.s);
  });

  rec.gen = 1;
  rec.bins.s = i.toString() + "GEN";
  client.put(k1, rec,  function(err) {
	console.log(err);
  });
  
  client.get(k1, function(err,bins,meta) {
	console.log(bins.s);
  });
 
  rec.bins.s = i.toString()+"GENFAIL";
  rec.gen = 60;
  client.put(k1, rec, write_policy, function(err) {
	console.log(err);
  });

}

