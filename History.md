v2.0.0-alpha.1 / 2016-03-28
===========================

* **Improvements**
  * Use asynchronous client commands of the new Aerospike C/C++ client library
    version 4.0.
  * Follow Node.js error-first callback conventions: The client now returns
    null as the first parameter (`error`) in most callbacks when the command
    was executed successfully. See
    [backward incompatible API changes](https://github.com/aerospike/aerospike-client-nodejs/blob/master/docs/api-changes.md)
    for more details. [#105](https://github.com/aerospike/aerospike-client-nodejs/issues/105),
    [PR #106](https://github.com/aerospike/aerospike-client-nodejs/pull/106). Thanks to
    [@eljefedelrodeodeljefe](https://github.com/eljefedelrodeodeljefe)!
  * Add support for pluggable callback handler logic for backwards
    compatibility with legacy error callback semantics.
  * The `Key`, `Double` and `GeoJSON` functions can be used as
    Constructors now to create instances of the respective data types, e.g.
    `var key = new Key(ns, set, 'mykey1')`. Use of the `Double` and `GeoJSON`
    functions as well as the `key` function as regular functions without the `new`
    keyword is deprecated but still supported for backwards compatibility.
  * The new `batchRead` command was added to support reading different
    namespaces/bins for each key in a batch. This method requires Aerospike
    server version >= 3.6.0. The batchGet/batchExists/batchSelect client
    commands deprecated but still supported for backwards compatibility.
  * Added `isConnected` client method to check cluster connection status.
  * Improvements to the client's mocha test suite, incl. performance
    improvements by re-using a single client connection for all tests.

* **Fixes**
  * Node segfault when trying to query the aerospike client after closing the
    connection. [#88](https://github.com/aerospike/aerospike-client-nodejs/issues/88)

* **Changes**
  * Drop support for Node.js v0.10. The Aerospike Node.js client now requires
    Node.js v0.12 or later.
  * The `add` client command was renamed to `incr`; the `add` function
    is maintained as an alias for the new `incr` function for backwards
    compatibility but is deprecated.
  * The `execute` client command was renamed to `apply`; the `execute` function
    is maintained as an alias for the new `apply` function for backwards
    compatibility but is deprecated.

* **Documentation**
  * JSDoc-style annotations have been added throughout the library code and new
    API documentation is generated from the source code using JSDoc v3. This is
    work-in-progress and will be completed before v2.0.0-final is released.

1.0.57 / 2016-03-18
===================

* **Improvements**
  * Update build script to support Fedora 23 as well as Korora 22/23.
    [#113](https://github.com/aerospike/aerospike-client-nodejs/issues/113),
    [#115](https://github.com/aerospike/aerospike-client-nodejs/issues/115)
  * Update Aerospike C client library to v4.0.3.
  * Optionally read hosts config from `AEROSPIKE_HOSTS` environment variable.
    Thanks to [@mrbar42](https://github.com/mrbar42)!
  * Collect TPS stats in benchmarks.
  * Update Travis CI config to test latest Node.js release & add badge. Thanks
    to [@revington](https://github.com/revington)!

* **Fixes**
  * Fix replica policy value overwriting gen policy [CLIENT-699]
  * Fix lists being returned as bytes in listGetRange/listPopRange operations
    (via C client library v4.0.3).

1.0.56 / 2016-02-11
===================

* **Improvements**
  * Support `operator.incr()` operation on double values.
  * Refactor test suite to improve performance and maintainability.

* **Fixes**
  * Fix segfault when `client.connect()` is called without callback function.

* **Documentation**
  * Fix wrong method name in llist documentation. Thanks to [@srinivasiyer](https://github.com/srinivasiyer)!
  * Update build dependencies for CentOS/RHEL 6.
  * Clarify supported data types and (lack of) automatic data type conversions.
  * Update supported Node.js versions.

1.0.55 / 2016-01-15
===================

* **Improvements**
  * Update to C Client v4.0.0.
  * Documentation updates. Thanks to [@mrbar42](https://github.com/mrbar42)!
  * Avoid polluting global namespace. Thanks to [@mrbar42](https://github.com/mrbar42)!
  * Use `standard` module to enforce coding style.
  * Add `connTimeoutMs` and `tenderInterval` client configs.

* **Fixes**
  * Fix connection issues when using V8 profiler (`node --prof`)
