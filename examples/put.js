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

/*******************************************************************************
 *
 * Write a record.
 * 
 ******************************************************************************/

var fs = require('fs');
var aerospike = require('aerospike');
var yargs = require('yargs');

var Policy = aerospike.policy;
var Status = aerospike.status;
var Double = aerospike.Double;

console.log(Double);
/*******************************************************************************
 *
 * Options parsing
 * 
 ******************************************************************************/

var argp = yargs
    .usage("$0 [options] key")
    .options({
        help: {
            boolean: true,
            describe: "Display this message."
        },
        profile: {
            boolean: true,
            describe: "Profile the operation."
        },
        host: {
            alias: "h",
            default: "127.0.0.1",
            describe: "Aerospike database address."
        },
        port: {
            alias: "p",
            default: 3000,
            describe: "Aerospike database port."
        },
        timeout: {
            alias: "t",
            default: 10,
            describe: "Timeout in milliseconds."
        },
        'log-level': {
            alias: "l",
            default: aerospike.log.INFO,
            describe: "Log level [0-5]"
        },
        'log-file': {
            default: undefined,
            describe: "Path to a file send log messages to."
        },
        namespace: {
            alias: "n",
            default: "test",
            describe: "Namespace for the keys."
        },
        set: {
            alias: "s",
            default: "demo",
            describe: "Set for the keys."
        },
        user: {
            alias: "U",
            default: null,
            describe: "Username to connect to secured cluster"
        },  
        password: {
            alias: "P",
            default: null,
            describe: "Password to connec to secured cluster"
        }  
    });

var argv = argp.argv;
var keyv = argv._.length === 1 ? argv._[0] : null;

if ( argv.help === true ) {
    argp.showHelp();
    process.exit(0);
}

if ( ! keyv ) {
    console.error("Error: Please provide a key for the operation");
    console.error();
    argp.showHelp();
    process.exit(1);
}

/*******************************************************************************
 *
 * Configure the client.
 * 
 ******************************************************************************/

config = {

    // the hosts to attempt to connect with.
    hosts: [
        { addr: argv.host, port: argv.port }
    ],
    
    // log configuration
    log: {
        level: argv['log-level'],
        file: argv['log-file'] ? fs.openSync(argv['log-file'], "a") : 2
    },

    // default policies
    policies: {
        timeout: argv.timeout
    }
};

if( argv.user !== null)
{
	config.user = argv.user;
}

if( argv.password !== null)
{
	config.password = argv.password;
}


/*******************************************************************************
 *
 * Perform the operation
 * 
 ******************************************************************************/
var client = aerospike.client(config);
if(client == null)
{
	console.error("Client object not initialized");
	process.exit(1);
}
client.connect(function (err, client) {

    if ( err.code != Status.AEROSPIKE_OK ) {
        console.error("Error: Aerospike server connection error. ", err.message);
        process.exit(1);
    }

    //
    // Perform the operation
    //

    /*var key = {
        ns:  argv.namespace,
        set: argv.set,
        key: keyv

    };*/

   var key = aerospike.key(argv.namespace, argv.set, keyv);

    var bins = {
        i: 1152921504606846976.456,
        d: 456.78,
        x: Double(123.00),
        s: "abc",
        l: [1, 2, 3],
        m: { s: "g3", i: 3, b: new Buffer( [0xa, 0xb, 0xc])},
        b: new Buffer([0xa, 0xb, 0xc]),
        b2: new Uint8Array([0xa, 0xb, 0xc])
    };

    console.log(bins.x);
    var metadata = {
        ttl: 10000,
        gen: 0
    };

    if ( argv.profile ) {
        console.time("put");
    }

    client.put(key, bins, metadata, function(err, key) {

        var exitCode = 0;

        switch ( err.code ) {
            case Status.AEROSPIKE_OK:
                break;
            
            default:
                console.error("Error: " + err.message);
                exitCode = 1;
                break;
        }

        if ( argv.profile === true ) {
            console.log("---");
            console.timeEnd("put");
        }

        process.exit(exitCode);
    });
});
