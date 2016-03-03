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

// *****************************************************************************
// Write a record
// *****************************************************************************

const Aerospike = require('aerospike')
const fs = require('fs')
const yargs = require('yargs')

const status = Aerospike.status
const filter = Aerospike.filter
const GeoJSON = Aerospike.GeoJSON

// *****************************************************************************
// Options parsing
// *****************************************************************************

var argp = yargs
  .usage('$0 [options] key')
  .options({
    help: {
      boolean: true,
      describe: 'Display this message.'
    },
    host: {
      alias: 'h',
      default: process.env.AEROSPIKE_HOSTS || 'localhost:3000',
      describe: 'Aerospike database address.'
    },
    timeout: {
      alias: 't',
      default: 10,
      describe: 'Timeout in milliseconds.'
    },
    'log-level': {
      alias: 'l',
      default: Aerospike.log.INFO,
      describe: 'Log level [0-5]'
    },
    'log-file': {
      default: undefined,
      describe: 'Path to a file send log messages to.'
    },
    namespace: {
      alias: 'n',
      default: 'test',
      describe: 'Namespace for the keys.'
    },
    set: {
      alias: 's',
      default: 'demo',
      describe: 'Set for the keys.'
    },
    user: {
      alias: 'U',
      default: null,
      describe: 'Username to connect to secured cluster'
    },
    password: {
      alias: 'P',
      default: null,
      describe: 'Password to connec to secured cluster'
    }
  })

var argv = argp.argv

if (argv.help === true) {
  argp.showHelp()
  process.exit(0)
}

// *****************************************************************************
// Configure the client
// *****************************************************************************

var config = {
  host: argv.host,
  log: {
    level: argv['log-level'],
    file: argv['log-file'] ? fs.openSync(argv['log-file'], 'a') : 2
  },
  policies: {
    timeout: argv.timeout
  },
  modlua: {
    userPath: __dirname
  },
  user: argv.user,
  password: argv.password
}

var g_nkeys = 20
var g_index = 'points-loc-index'

function execute_query (client) {
  var count = 0
  var region = {
    type: 'Polygon',
    coordinates: [
      [[-122.500000, 37.000000], [-121.000000, 37.000000],
        [-121.000000, 38.080000], [-122.500000, 38.080000],
        [-122.500000, 37.000000]]
    ]
  }

  var options = { filters: [filter.geoWithin('loc', new GeoJSON(region))] }

  var q = client.query(argv.namespace, argv.set, options)

  var stream = q.execute()

  stream.on('data', function (rec) {
    console.log(rec)
    count++
  })

  stream.on('error', function (err) {
    console.log('at error')
    console.log(err)
    cleanup(client, process.exit)
  })

  stream.on('end', function () {
    console.log('RECORDS FOUND:', count)
    cleanup(client, process.exit)
  })
}

function insert_records (client, ndx, end) {
  if (ndx >= end) {
    return execute_query(client)
  }

  var key = { ns: argv.namespace, set: argv.set, key: ndx }

  var lng = -122 + (0.1 * ndx)
  var lat = 37.5 + (0.1 * ndx)

  var loc = { type: 'Point', coordinates: [lng, lat] }
  var bins = {
    loc: new GeoJSON(loc)
  }
  client.put(key, bins, function (err, key) {
    if (err) {
      console.error('insert_records: put failed: ', err.message)
      process.exit(1)
    }
    insert_records(client, ndx + 1, end)
  })
}

function create_index (client) {
  var options = {
    ns: argv.namespace,
    set: argv.set,
    bin: 'loc',
    index: g_index
  }
  client.createGeo2DSphereIndex(options, function (err) {
    if (err) {
      console.log('index create failed: ', err)
      process.exit(1)
    }
    client.indexCreateWait(options.ns, g_index, 100, function (err) {
      if (err) {
        console.log('index create failed: ', err)
        process.exit(1)
      }
      insert_records(client, 0, g_nkeys)
    })
  })
}

function remove_index (client, complete) {
  client.indexRemove(argv.namespace, g_index, function (err) {
    if (err && err.code !== status.AEROSPIKE_ERR_RECORD_NOT_FOUND) {
      throw new Error(err.message)
    }
    complete(client)
  })
}

function remove_records (client, ndx, end, complete) {
  if (ndx >= end) {
    return remove_index(client, complete)
  }

  var key = { ns: argv.namespace, set: argv.set, key: ndx }

  client.remove(key, function (err, key) {
    if (err && err.code !== status.AEROSPIKE_ERR_RECORD_NOT_FOUND) {
      throw new Error(err.message)
    }
    remove_records(client, ndx + 1, end, complete)
  })
}

function cleanup (client, complete) {
  remove_records(client, 0, g_nkeys, complete)
}

Aerospike.connect(config, function (err, client) {
  if (err) {
    console.error('Error: Aerospike server connection error. ', err.message)
    process.exit(1)
  } else {
    create_index(client)
  }
})
