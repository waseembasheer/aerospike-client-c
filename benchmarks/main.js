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

/***********************************************************************
 *
 * node -O 10000 -P 4 -R 0.5
 *
 ***********************************************************************/

var aerospike = require('aerospike');
var cluster = require('cluster');
var yargs = require('yargs');
var os = require('os');
var path = require('path');
var util = require('util');
var winston = require('winston');
var stats = require('./stats');

/***********************************************************************
 *
 * Globals
 *
 ***********************************************************************/

var kB = 1024;
var MB = kB * 1024;
var GB = MB * 1024;

var MEMCHART_MAX_MB = 400;
var MEMCHART_BUCKETS = 100;
var MEMCHART_BAR = new Buffer(MEMCHART_BUCKETS+1);

var cpus = os.cpus();
var online = 0;
var exited = 0;
var timerId;

var iterations_results = [];

/***********************************************************************
 *
 * Options Parsing
 *
 ***********************************************************************/

var argp = yargs
    .usage("$0 [options]")
    .options({
        help: {
            boolean: true,
            describe: "Display this message."
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
        log: {
            alias: "l",
            default: 1,
            describe: "Log level [0-5]."
        },
        namespace: {
            alias: "n",
            default: "test",
            describe: "Key namespace."
        },
        set: {
            alias: "s",
            default: "demo",
            describe: "Key set."
        },
        user: {
            alias: "U",
            default:null,
            describe: "Username to connect to a secure cluster"
        },  
        password: {
            alias: "P",
            default: null,
            describe: "Password to connect to a secure cluster"
        },  
        json: {
            alias: "j",
            default: false,
            describe: "Display report in JSON format."
        },
        silent: {
            default: false,
            describe: "Suppress intermediate output from workers."
        },
        operations: {
            alias: "O",
            default: 100,
            describe: "Total number of operations to perform per iteration per process."
        },
        iterations: {
            alias: "I",
            default: 1,
            describe: "Total number of iterations to perform per process."
        },
        processes: {
            alias: "N",
            default: cpus.length,
            describe: "Total number of child processes."
        },
        time: {
            alias: "T",
            default: undefined,
            describe: "Total amount of time to run the benchmark (seconds). Units may be used: 1h, 30m, 30s"
        },
        reads: {
            alias: "R",
            default: 1,
            describe: "The read in the read/write ratio."
        },
        writes: {
            alias: "W",
            default: 1,
            describe: "The write in the read/write ratio."
        },
        keyrange: {
            alias: "K",
            default: 1000,
            describe: "The number of keys to use."
        },
        datatype: {
            default: "INTEGER",
            describe: "The datatype of the record."
        },
        datasize: {
            default: 8,
            describe: "Size of the record."
        },
        'chart-memory': {
            boolean: false,
            default: false,
            describe: "Chart the memory used before printing the summary."
        },
        'summary': {
            boolean: true,
            default: true,
            describe: "Produces a summary report (tables, charts, etc) at the end."
        }
    });

var argv = argp.argv;

if ( argv.help === true) {
    argp.showHelp()
    return;
}

if ( !cluster.isMaster ) {
    console.error('main.js must not run as a child process.');
    return;
}
    
var FOPS = (argv.operations / (argv.reads + argv.writes));
var ROPS = FOPS * argv.reads;
var WOPS = FOPS * argv.writes;

if ( (ROPS + WOPS) < argv.operations ) {
    DOPS = argv.operations - (ROPS + WOPS);
    ROPS += DOPS;
}

if ( argv.time !== undefined ) {
    var time_match = argv.time.toString().match(/(\d+)([smh])?/)
    if ( time_match !== null ) {
        if ( time_match[2] !== null ) {
            argv.time = parseInt(time_match[1],10);
            var time_unit = time_match[2];
            switch( time_unit ) {
                case 'm':
                    argv.time = argv.time * 60;
                    break;
                case 'h':
                    argv.time = argv.time * 60 * 60;
                    break;
            }
            argv.iterations = undefined;
        }
    }
}

/***********************************************************************
 *
 * Logging
 *
 ***********************************************************************/

function logger_timestamp() {
    var hrtime = process.hrtime()
    return util.format('[master: %d] [%s]', process.pid, hrtime);
}

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            level: 'info',
            silent: false,
            colorize: true,
            timestamp: logger_timestamp
        })
    ]
});


/***********************************************************************
 *
 * Functions
 *
 ***********************************************************************/

function finalize() {
    if ( argv['summary'] === true ) {
        return stats.report_final(iterations_results, argv, console.log);
    }
}

function worker_spawn() {
    var worker = cluster.fork();
    worker.iteration = 0;
    worker.on('message', worker_results(worker));
}

function worker_exit(worker) {
    worker.send(['end']);
}

function worker_shutdown() {
    Object.keys(cluster.workers).forEach(function(id) {
        worker_exit(cluster.workers[id]);
    });
}

/**
 * Data to be written for the record type string.
 */
var STRING_DATA = "This the test data to be written to the server"
var CHAR_DATA = "DATAS";

/**
 * key are in range [1 ... argv.keyrange]
 */
function keygen() {
    var rand = Math.floor(Math.random() * 0x100000000) % argv.keyrange + 1;
    return rand < 1 ? 1 : rand;
}

/**
 * Generate data of size argv.datasize with a gven datatype argv.datatype
 * Currently string datatype from size 5 to argv.datatype.
 * And 8 byte size integers are supported
 */

function datagen ( key ) {
    var data; 
    switch (argv.datatype) {
        case "INTEGER" :
        {
            return key;
        }
        case "STRING"  :
        {
            data =  CHAR_DATA;
            while ( data.length < argv.datasize )
            {
                data += STRING_DATA;
            }
            data += key;
            return data;
        }   
		case "BYTES" :
		{
			data = new Buffer(argv.datasize);
			var i = 0;
			while( i < argv.datasize)
			{
				data.writeUInt8(i,i++);
			}
			return data;
		}
        default :
            return key;
    }
    
}
function putgen(commands) {
    var key = keygen();
    var data = datagen( key);
    commands.push(['put', key, {k: data}]);
}

function getgen(commands) {
    var key = keygen();
    commands.push(['get', key]);
}

function opgen(ops, commands) {

    var rand = Math.floor(Math.random() * 0x100000000) % 2;

    if ( ops[rand][0] >= 0 ) {
        ops[rand][1](commands);
        ops[rand][0]--;
    }
}

function worker_run(worker) {

    var commands = [];

    var ops = [
        [ROPS, getgen],
        [WOPS, putgen]
    ];

    worker.iteration++;

    for (; commands.length < argv.operations;) {
        opgen(ops, commands);
    }

    worker.send(['run', commands]);
}

function worker_results_iteration(worker, iteration_stats) {

    var result = {
        worker: worker.id,
        pid: worker.process.pid,
        iteration: worker.iteration,
        stats: iteration_stats
    };

    if ( argv['summary'] === true ) {
        iterations_results.push(result);
    }

    if ( argv['summary'] === false && argv['chart-memory'] === true && worker.id == 1 ) {
        stats.chart_iteration_memory(worker.iteration, 1, result, MEMCHART_BAR, MEMCHART_MAX_MB, MEMCHART_BUCKETS, logger.info)
    }

    if ( !argv.silent ) {
        stats.report_iteration(result, argv, logger.info);
    }

    if ( worker.iteration < argv.iterations || argv.time !== undefined ) {
        worker_run(worker);
    }
    else {
        worker_exit(worker);
    }
}

function worker_results(worker) {
    return function(message) {
        worker_results_iteration(worker, message);
    }
}

/***********************************************************************
 *
 * Event Listeners
 *
 ***********************************************************************/

process.on('exit', function() {
    logger.debug('Exiting.');
    if ( exited == online ) {
        return finalize();
    }
});

process.on('SIGINT', function() {
    logger.debug('Recevied SIGINT.');
});

process.on('SIGTERM', function() {
    logger.debug('Received SIGTERM.');
});

cluster.on('online', function(worker) {
    online++;
    worker_run(worker);
});

cluster.on('disconnect', function(worker, code, signal) {
    logger.debug("[worker: %d] Disconnected.", worker.process.pid, code);
});

cluster.on('exit', function(worker, code, signal) {
    if ( code !== 0 ) {
        // non-ok status code
        logger.error("[worker: %d] Exited: %d", worker.process.pid, code);
        process.exit(1);
    }
    else {
        logger.debug("[worker: %d] Exited: %d", worker.process.pid, code);
        exited++;
    }
    if ( exited == online ) {
        process.exit(0);
    }
});
/***********************************************************************
 *
 * Setup Workers
 *
 ***********************************************************************/

cluster.setupMaster({
    exec : "worker.js",
    silent : false
});

if ( argv.time !== undefined ) {
    timerId = setTimeout(function(){
        worker_shutdown(cluster);
     }, argv.time*1000);
}

for ( p = 0; p < argv.processes; p++ ) {
    worker_spawn();
}
