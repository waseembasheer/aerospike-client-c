# Aerospike Node.js Client

An Aerospike add-on module for Node.js.

This module is compatible with Node.js 0.10.x and supports the following operating systems: CentOS/RHEL 6.x, Debian 6+, Ubuntu 12.04, Ubuntu 14.04, Mac OS X.

- [Usage](#Usage)
- [Prerequisites](#Prerequisites)
- [Installation](#Installation)
  - [Primer on Node.js Modules](#Primer-on-Node.js-Modules)
  - [Installing via NPM Registry](#Installing-via-NPM-Registry)
  - [Installing via Git Repository](#Installing-via-Git-Repository)
  - [C Client Resolution](#C-Client-Resolution)
    - [Force Download](#Force-Download)
    - [Custom Search Path](#Custom-Search-Path)
- [Tests](#Tests)
- [Examples](#Examples)
- [Benchmarks](#Benchmarks)
- [API Documentaion](#API-Documentation)

<a name="Usage"></a>
## Usage

The following is very simple example of how to write and read a record from Aerospike. 

```js
var aerospike = require('aerospike');


// Connect to the cluster.
var client = aerospike.client({
    hosts: [ { addr: '127.0.0.1', port: 3000 } ]
});

function connect_cb( err, client) {
    if (err.code == AEROSPIKE_OK) {
        console.log("Aerospike Connection Success")
    }
}

client.connect(connect_cb)

// The key of the record we are reading.
var key = aerospike.key('test','demo','foo');

// Read the record from the database
client.get(key, function(err, rec, meta) {
    
    // Check for errors
    if ( err.code == aerospike.status.AEROSPIKE_OK ) {
    	// The record was successfully read.
    	console.log(rec, meta);
    }
    else {
        // An error occurred
        console.error('error:', err);
    }
});
```

More examples illustrating the use of the API are located in the 
[`examples`](examples) directory. 

Details about the API are available in the [`docs`](docs) directory.

<a name="Prerequisites"></a>
## Prerequisites

[Node.js](http://nodejs.org) version v0.10.x is required. 

To install the latest stable version of Node.js, visit 
[http://nodejs.org/download/](http://nodejs.org/download/)

Aerospike Node.js has a dependency on Aerospike C client, which is
downloaded during the installation. 
To Download Aerospike C client, curl is required.
The client library requires the following libraries to be present on the machine for building and running.


- CentOS/RHEL 6.x
| Library Name | .rpm Package | Description |
| --- | --- | --- |
| libssl | openssl | |
| libcrypto | openssl | Required for RIPEMD160 hash function. |
| liblua5.1 | lua | Required for Lua execution. |

To install library prerequisites via `yum`:

```bash
sudo yum install openssl-devel lua-devel
```

Some CentOS installation paths do not include necessary C development tools. You may need the following packages:

```bash
sudo yum install gcc gcc-c++
```
- Debian 6+
- Ubuntu 12.04
- Ubuntu 14.04
- Mac OS X

<a name="Installation"></a>
## Installation

The Aerospike Node.js client is a Node.js add-on module utilizing the Aerospike 
C client. The installation will attempt to build the add-on module prior to 
installation. The build step will resolve the Aerospike C client dependency as 
described in [C Client Resolution](#C-Client-Resolution).

The Aerospike Node.js client can be installed like any other Node.js module, however
we provided the following information for those not so familiar with Node.js modules. 

<a name="Primer-on-Node.js-Modules"></a>
### Primer on Node.js Modules

Node.js modules are containers of JavaScript code and a `package.json`, which defines
the module, its dependencies and requirements. Modules are usually installed as 
dependencies of others Node.js application or module. The modules are installed in 
the application's `node_modules` directory, and can be utilized within the program 
by requiring the module by name. 

A module may be installed in global location via the `-g` flag. The global location
is usually reserved for modules that are not directly depended on by an application,
but may have executables which you want to be able to call regardless of the 
application. This is usually the case for tools like tools like `npm` and `mocha`.

<a name="Installing-via-NPM-Registry"></a>
### Installing via NPM Registry

Installing via NPM Registry is pretty simple and most common install method, as 
it only involves a single step.

Although the module may be installed globally or locally, we recommend performing 
local installs.

To install the module as a dependency of your application, run the following 
from your application's directory:

	$ npm install aerospike

In most cases, an application should specify `aerospike` as a dependency in 
its `package.json`.

Once installed, the module can be required in the application:

	var aerospike = require('aerospike')

<a name="Installing-via-Git-Repository"></a>
### Installing via Git Repository

The following is relevant for users who have cloned the repository, and want 
to install it as a dependency of their application.

Installing via Git Repository is slightly different from installing via NPM 
registry, in that you will be referencing the module by path, rather than name.

Although the module may be installed globally or locally, we recommend performing 
local installs.

#### Installing Globally

This option required root permissions. This will download the Aerospike C client
only once, which will improve the experience of using the module for many users. 
However, you will need to first install the package globally using root permissions.

Run the following as a user with root permission or using the sudo command:

	$ npm install -g <PATH>

Where `<PATH>` is the path to the Aerospike Node.js client's Git respository is 
located. This will install the module in a globally accessible location.

To install the module as a dependency of your application, run the following 
from your application's directory:

	$ npm link aerospike

Linking to the module does not require root permission.

Once linked, the module can be required in the application:

	var aerospike = require('aerospike')

#### Installing Locally

This option does not require root permissions to install the module as a 
dependency of an application. However, it will require resolving the Aerospike
C client each time you install the dependency, as it will need to exist local
to the application.

To install the module as a dependency of your application, run the following 
from your application's directory:

	$ npm install <PATH>

Where `<PATH>` is the path to the Aerospike Node.js client's Git respository is 
located. 

Once installed, the module can be required in the application:

	var aerospike = require('aerospike')


<a name="C-Client-Resolution"></a>
### C Client Resolution

When running `npm install`, `npm link` or `node-gyp rebuild`, the `.gyp`
script will run `scripts/aerospike-client-c.sh` to resolve the C client 
dependency.

The script will check for the following files in the search paths:

- `lib/libaerospike.a`
- `include/aerospike/aerospike.h`

By default, the search paths are:

- `./aerospike-client-c`
- `/usr`

If neither are found, then it will download the C client and create the 
`./aerospike-client-c` directory.

You can modify the C client resolution via:

- [force download](#Force-Download) the C client
- Specifying a [custom search path](#Custom-Search-Path) for the C client.

<a name="Force-Download"></a>
#### Force Download

To force downloading of the C client, you can specify the `DOWNLOAD=1` 
environment variable. Example:

    $ DOWNLOAD=1 npm install

<a name="Custom-Search-Path"></a>
#### Custom Search Path 

If you have the Aerospike C client installed in a non-standard location or 
built from source, then you can specify the search path for the build step to
use while resolving the Aerospike C client library.

Use the `PREFIX=<PATH>` environment variable to specify the search path for the
Aerospike C client. The `<PATH>` must be the path to a directory containing 
`lib` and `include` subdirectories. 

The following is an example of specifying the path to the Aerospike C client 
build directory:

    $ PREFIX=~/aerospike-client-c/target/Linux-x86_64 npm install

<a name="Tests"></a>
## Tests

This module is packaged with a number of tests in the `test` directory.

Before running the tests, you need to update the dependencies:

    $ npm update

To run all the test cases:

    $ npm test

For details on the tests, see [`test/README.md`](test/README.md).


<a name="Examples"></a>
## Examples

A variety of example applications are provided in the [`examples`](examples) directory. 
See the [`examples/README.md`](examples/README.md) for details.

<a name="Benchmarks"></a>
## Benchmarks

Benchmark utilies are provided in the [`benchmarks`](benchmarks) directory. 
See the [`benchmarks/README.md`](benchmarks/README.md) for details.

<a name="API-Documentation"></a>
## API Documentation

API documentation is provided in the [`docs`](docs/README.md) directory.

## License

The Aerospike Node.js Client is made availabled under the terms of the Apache License, Version 2, as stated in the file `LICENSE`.

Individual files may be made available under their own specific license, 
all compatible with Apache License, Version 2. Please see individual files for details.
