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

extern "C" {
    #include <aerospike/aerospike.h>
    #include <aerospike/aerospike_key.h>
    #include <aerospike/as_config.h>
    #include <aerospike/as_key.h>
    #include <aerospike/as_record.h>
    #include <aerospike/as_record_iterator.h>
}

#include <node.h>
#include <cstdlib>
#include <unistd.h>

#include "client.h"
#include "async.h"
#include "conversions.h"
#include "log.h"


#define FILESIZE         255

using namespace v8;

/*******************************************************************************
 *  TYPES
 ******************************************************************************/

/**
 *  AsyncData — Data to be used in async calls.
 *
 *  libuv allows us to pass around a pointer to an arbitraty object when
 *  running asynchronous functions. We create a data structure to hold the
 *  data we need during and after async work.
 */

typedef struct AsyncData {
    aerospike * as;
    int param_err;
    as_error err;
    as_policy_apply* policy;
    as_key key;
    char filename[FILESIZE];
    char funcname[FILESIZE];
    as_arraylist udfinfo;
    LogInfo * log;
    as_val* result;
    Nan::Persistent<Function> callback;
} AsyncData;


/*******************************************************************************
 *  FUNCTIONS
 ******************************************************************************/

/**
 *  prepare() — Function to prepare AsyncData, for use in `execute()` and `respond()`.
 *
 *  This should only keep references to V8 or V8 structures for use in
 *  `respond()`, because it is unsafe for use in `execute()`.
 */
static void * prepare(ResolveArgs(info))
{
    Nan::HandleScope scope;

    AerospikeClient * client    = ObjectWrap::Unwrap<AerospikeClient>(info.This());

    AsyncData * data            = new AsyncData();
    data->as                    = client->as;
    data->param_err             = 0;
    data->result                = NULL;
    data->policy                = NULL;
    LogInfo * log = data->log   = client->log;

    as_arraylist* udfinfo = &data->udfinfo;
    char * filename = data->filename;
    char * funcname = data->funcname;
    memset(data->filename, 0, FILESIZE);
    memset(data->funcname, 0, FILESIZE);

    Local<Value> maybe_key = info[0];
    Local<Value> maybe_udf_info = info[1];
    Local<Value> maybe_policy = info[2];
    Local<Value> maybe_callback = info[3];

    if (maybe_callback->IsFunction()) {
        data->callback.Reset(maybe_callback.As<Function>());
        as_v8_detail(log, "Node.js Callback Registered");
    } else {
        as_v8_error(log, "No callback to register");
        COPY_ERR_MESSAGE(data->err, AEROSPIKE_ERR_PARAM);
        goto Err_Return;
    }

    if (maybe_key->IsObject()) {
        if (key_from_jsobject(&data->key, maybe_key->ToObject(), log) != AS_NODE_PARAM_OK ) {
            as_v8_error(log,"Parsing as_key(C structure) from key object failed");
            COPY_ERR_MESSAGE(data->err, AEROSPIKE_ERR_PARAM);
            goto Err_Return;
        }
    } else {
        as_v8_error(log, "Key should be an object");
        COPY_ERR_MESSAGE(data->err, AEROSPIKE_ERR_PARAM);
        goto Err_Return;
    }

    if (maybe_udf_info->IsObject()) {
        if (udfargs_from_jsobject(&filename, &funcname, &udfinfo, maybe_udf_info->ToObject(), log) != AS_NODE_PARAM_OK ) {
            as_v8_error(log, "Parsing UDF arguments failed");
            COPY_ERR_MESSAGE(data->err, AEROSPIKE_ERR_PARAM);
            goto Err_Return;
        }
    } else {
        as_v8_error(log, "UDF info should be an object");
        COPY_ERR_MESSAGE(data->err, AEROSPIKE_ERR_PARAM);
        goto Err_Return;
    }

    if (maybe_policy->IsObject()) {
        data->policy = (as_policy_apply*) cf_malloc(sizeof(as_policy_apply));
        if(applypolicy_from_jsobject(data->policy, maybe_policy->ToObject(), log) != AS_NODE_PARAM_OK) {
            as_v8_error(log, "apply policy shoule be an object");
            COPY_ERR_MESSAGE(data->err, AEROSPIKE_ERR_PARAM);
            goto Err_Return;
        }
    }

    return data;

Err_Return:
    data->param_err = 1;
    return data;
}

/**
 *  execute() — Function to execute inside the worker-thread.
 *
 *  It is not safe to access V8 or V8 data structures here, so everything
 *  we need for input and output should be in the AsyncData structure.
 */
static void execute(uv_work_t * req)
{
    // Fetch the AsyncData structure
    AsyncData * data         = reinterpret_cast<AsyncData *>(req->data);
    aerospike * as           = data->as;
    as_error *  err          = &data->err;
    as_key *    key          = &data->key;
    as_policy_apply * policy = data->policy;
    LogInfo * log            = data->log;

    // Invoke the blocking call.
    // The error is handled in the calling JS code.
    if (as->cluster == NULL) {
        data->param_err = 1;
        COPY_ERR_MESSAGE(data->err, AEROSPIKE_ERR_PARAM);
        as_v8_error(log, "Not connected to cluster to execute record udf");
    }

    if ( data->param_err == 0) {
        as_v8_debug(log, "Invoking aerospike execute ");
        aerospike_key_apply(as, err, policy, key, data->filename, data->funcname, (as_list*) &data->udfinfo, &data->result);
    }

}

/**
 *  AfterWork — Function to execute when the Work is complete
 *
 *  This function will be run inside the main event loop so it is safe to use
 *  V8 again. This is where you will convert the results into V8 types, and
 *  call the callback function with those results.
 */
static void respond(uv_work_t * req, int status)
{
    Nan::HandleScope scope;

    // Fetch the AsyncData structure
    AsyncData * data    = reinterpret_cast<AsyncData *>(req->data);
    as_error *  err     = &data->err;
    as_key *    key     = &data->key;
    LogInfo * log       = data->log;
    as_arraylist* array = &data->udfinfo;
    as_v8_debug(log, "UDF execute operation : response is %d", err->code);

    // Build the arguments array for the callback
    Local<Value> argv[2];

    if (data->param_err == 0) {
        argv[0] = error_to_jsobject(err, log);
        argv[1] = val_to_jsvalue( data->result, log);
    }
    else {
        err->func = NULL;
        argv[0] = error_to_jsobject(err, log);
        argv[1] = Nan::Null();
    }

    // Surround the callback in a try/catch for safety
    Nan::TryCatch try_catch;

    // Execute the callback.
    Local<Function> cb = Nan::New<Function>(data->callback);
    Nan::MakeCallback(Nan::GetCurrentContext()->Global(), cb, 2, argv);

    // Process the exception, if any
    if ( try_catch.HasCaught() ) {
        Nan::FatalException(try_catch);
    }

    // Dispose the Persistent handle so the callback
    // function can be garbage-collected
    data->callback.Reset();

    // clean up any memory we allocated

    if ( data->param_err == 0) {
        as_arraylist_destroy(array);
        as_val_destroy(data->result);
        as_key_destroy(key);
        as_v8_debug(log, "Cleaned up key structure");
        if( data->policy != NULL)
        {
            cf_free(data->policy);
        }
    }

    delete data;
    delete req;
}

/*******************************************************************************
 *  OPERATION
 ******************************************************************************/

/**
 *  The 'put()' Operation
 */
NAN_METHOD(AerospikeClient::Execute)
{
    async_invoke(info, prepare, execute, respond);
}
