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
    #include <aerospike/aerospike_query.h>
    #include <aerospike/as_config.h>
    #include <aerospike/as_key.h>
    #include <aerospike/as_record.h>
    #include <aerospike/as_record_iterator.h>
	#include <citrusleaf/cf_queue.h>
}

#include <node.h>
#include <cstdlib>
#include <unistd.h>
#include <time.h>

#include "query.h"
#include "client.h"
#include "async.h"
#include "conversions.h"
#include "log.h"
using namespace v8;
#define QUEUE_SZ 100000
/*******************************************************************************
 *  TYPES
 ******************************************************************************/
typedef struct AsyncData {
    int param_err;
    aerospike * as;
	bool is_query;
	bool has_udf;
	uint64_t  scan_id;
	union {
		as_query* query;
		as_scan* scan;
	} query_scan;
    as_error err;
    union {
		as_policy_query query;
		as_policy_scan scan;
	} policy;
	as_status res;
    LogInfo * log;
	AsyncCallbackData* query_cbdata;
} AsyncData;

/*******************************************************************************
 *  FUNCTIONS
 ******************************************************************************/
// callback for query here.
// Queue the record into a common queue and generate an event 
// when the queue size reaches 1/20th of the total size of the queue.
// @TO-DO
// Who destroys the as_val in the callback, caller or callee.

bool aerospike_query_callback(const as_val * val, void* udata)
{
	AsyncCallbackData *query_cbdata = reinterpret_cast<AsyncCallbackData*>(udata);

	if(val == NULL) 
	{
		as_v8_debug(query_cbdata->log, "value returned by query callback is NULL");
		return false;
	}

	// push the record from the server to a queue.
	// Why? Here the record cannot be directly passed on from scan callback to v8 thread.
	// Because v8 objects can only be created inside a v8 context. This callback is in 
	// C client thread, which is not aware of the v8 context.
	// So store this records in a temporary queue.
	// When a queue reaches a certain size, signal v8 thread to process this queue.
	return async_queue_populate(val, query_cbdata);
}

/* There is one common class AerospikeQuery for both scan and query.
 * This function parses the values from AerospikeQuery and populates either
 * scan or query depending on the boolean combination of isQuery and hasUDF variables.
 * ---------------------------------------
 * IsQuery  | hasUDF | Function          |
 * ---------------------------------------
 *  0	    | 0      | Scan Foreground   |
 *  0       | 1      | Scan Background   |
 *  1       | 0      | Query             |
 *  1       | 1      | Aggregation       |
 * --------------------------------------- */
bool populate_scan_or_query(AsyncData* data, AerospikeQuery* v8_query)
{
	// populate the values for scan. 
	// we have not allocated the as_scan object anywhere earlier. 
	// Allocate as_scan here.
	LogInfo * log = v8_query->log;
	if(!v8_query->IsQuery)
	{
		as_v8_debug(log, "The Scan operation invoked");
		data->query_scan.scan = (as_scan*) cf_malloc(sizeof(as_scan));
		as_scan * scan  = data->query_scan.scan;
		as_query* query = &v8_query->query;

		data->is_query = v8_query->IsQuery;
		data->has_udf  =  v8_query->hasUDF;
		if(data->has_udf)
		{
			as_v8_debug(log,"It's a background scan operation");
		}
		as_scan_init(scan, query->ns, query->set);
		as_v8_debug(log,"ns = %s and set = %s for scan ", query->ns, query->set); 
		as_scan_apply_each(scan, query->apply.module, query->apply.function, query->apply.arglist);
		as_v8_detail(log, "Number of bins to select in scan %d ", query->select.size);
		as_scan_select_init(scan, query->select.size);
		for ( uint16_t i = 0; i < query->select.size; i++)
		{
			as_scan_select(scan, (const char*) query->select.entries[i]);
			as_v8_detail(log, "setting the select bin in scan to %s", scan->select.entries[i]);
		}

		// set the scan properties from AerospikeQuery object.
		as_scan_set_concurrent( scan, v8_query->concurrent);
		as_v8_detail(log, "concurrent property in scan is set to %d", (int) v8_query->concurrent);
		as_scan_set_nobins(scan, v8_query->nobins);
		as_v8_detail(log, "nobins property in scan is set to %d", (int) v8_query->nobins);
		as_scan_set_percent(scan, v8_query->percent);
		as_v8_detail(log, "percent in scan is set to %d", v8_query->percent);
		as_scan_set_priority(scan, (as_scan_priority) v8_query->scan_priority);
		as_v8_detail(log, "priority in scan is set to %d", v8_query->scan_priority);

	}
	else // it's a normal query - just update the query pointer. 
	{
		// query structure is populated in AerospikeQuery class itself.
		// But scan structure is populated above because
		// in future scan will be merged to query structure. Then this 
		// if else won't be necessary.
		data->query_scan.query  = &v8_query->query;
	}
	return true;

}

/**
 *  prepare() — Function to prepare AsyncData, for use in `execute()` and `respond()`.
 *  
 *  This should only keep references to V8 or V8 structures for use in 
 *  `respond()`, because it is unsafe for use in `execute()`.
 */
static void * prepare(const Arguments& args)
{
    // The current scope of the function
    NODE_ISOLATE_DECL;
    HANDLESCOPE;

    AerospikeQuery* query			= ObjectWrap::Unwrap<AerospikeQuery>(args.This());
    // Build the async data
    AsyncData * data				= new AsyncData;
	AsyncCallbackData* query_cbdata	= new AsyncCallbackData;
    data->as						= query->as;
    LogInfo * log					= data->log = query->log;
	query_cbdata->log				= log;
	data->query_cbdata				= query_cbdata;
	data->is_query					= query->IsQuery;
	data->has_udf					= query->hasUDF;
    data->param_err					= 0;
	data->res						= AEROSPIKE_OK;
	int curr_arg_pos				= 0;

	populate_scan_or_query(data, query);

	//scan background - no need to create a result queue.
	if(!data->is_query && data->has_udf)
	{
		data->scan_id					= 0;
	}
	else // queue creation job for scan_foreground, query, aggregation.
	{
		query_cbdata->signal_interval	= 0;
		query_cbdata->result_q			= cf_queue_create(sizeof(as_val*), true);
		query_cbdata->max_q_size		= query->q_size ? query->q_size : QUEUE_SZ;
	}
		
    // Local variables

    int arglength					= args.Length();

	// For query, aggregation and scan foreground data callback must be present
	// for scan_background callback for data is NULL.
	if((args[curr_arg_pos]->IsFunction()) || ( !data->is_query && data->has_udf && args[curr_arg_pos]->IsNull()))
	{
		query_cbdata->data_cb	= Persistent<Function>::New(NODE_ISOLATE_PRE Local<Function>::Cast(args[curr_arg_pos]));
		curr_arg_pos++;
	}
	else
	{
		as_v8_error(log, "Callback not passed to process the  query results");
		data->param_err = 1;
		goto ErrReturn;
	}
    
	if(args[curr_arg_pos]->IsFunction())
	{
		query_cbdata->error_cb	= Persistent<Function>::New(NODE_ISOLATE_PRE Local<Function>::Cast(args[curr_arg_pos]));
		curr_arg_pos++;
	}
	else 
	{
		as_v8_error(log, "Callback not passed to process the error message");
		data->param_err = 1;
		goto ErrReturn;
	}
	if(args[curr_arg_pos]->IsFunction())
	{
		query_cbdata->end_cb	= Persistent<Function>::New(NODE_ISOLATE_PRE Local<Function>::Cast(args[curr_arg_pos]));
		curr_arg_pos++;
	}
	else 
	{
		as_v8_error(log, "Callback not passed to notify the end of query");
		data->param_err = 1;
		goto ErrReturn;
	}


	// If it's a query, then there are 3 callbacks and one optional policy objects.
    if (arglength > 3)  
	{
        if ( args[curr_arg_pos]->IsObject()) 
		{
            if (data->is_query && querypolicy_from_jsobject( &data->policy.query, args[curr_arg_pos]->ToObject(), log)
					!= AS_NODE_PARAM_OK) 
			{
                as_v8_error(log, "Parsing of querypolicy from object failed");
                COPY_ERR_MESSAGE( data->err, AEROSPIKE_ERR_PARAM );
				data->param_err = 1;
				goto ErrReturn;
            }
			else if( scanpolicy_from_jsobject( &data->policy.scan, args[curr_arg_pos]->ToObject(), log) != AS_NODE_PARAM_OK )
			{
                as_v8_error(log, "Parsing of scanpolicy from object failed");
                COPY_ERR_MESSAGE( data->err, AEROSPIKE_ERR_PARAM );
				data->param_err = 1;
				goto ErrReturn;
			}
        }
        else 
		{
            as_v8_error(log, "Policy should be an object");
            COPY_ERR_MESSAGE( data->err, AEROSPIKE_ERR_PARAM );
			data->param_err = 1;
			goto ErrReturn;
        }
    }
    else 
	{
        as_v8_detail(log, "Argument list does not contain query policy, using default values for query policy");
		if( data->is_query) 
		{
			as_policy_query_init(&data->policy.query);
		}
		else
		{
			as_policy_scan_init(&data->policy.scan);
		}
    }

	

ErrReturn:
	scope.Close(Undefined());
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
    AsyncData * data = reinterpret_cast<AsyncData *>(req->data);

    // Data to be used.
    aerospike * as					 = data->as;
    as_error *  err					 = &data->err;
    LogInfo * log					 = data->log;

    // Invoke the blocking call.
    // The error is handled in the calling JS code.
    if (as->cluster == NULL) {
        as_v8_error(log, "Not connected to Cluster to perform the operation");
        data->param_err = 1;
        COPY_ERR_MESSAGE(data->err, AEROSPIKE_ERR_PARAM);
    }

    if ( data->param_err == 0 ) {
		// it's a query with a where clause.
		if( data->is_query) 
		{
			// register the uv_async_init event here, for the query callback to be invoked at regular interval.
			async_init(&data->query_cbdata->async_handle, async_callback);
			data->query_cbdata->async_handle.data = data->query_cbdata;
			as_v8_debug(log, "Invoking aerospike_query_foreach  ");

			data->res = aerospike_query_foreach( as, err, &data->policy.query, data->query_scan.query, aerospike_query_callback, 
					(void*) data->query_cbdata); 

			// send an async signal here. If at all there's any residual records left in the result_q,
			// this signal's callback will send it to node layer.
			data->query_cbdata->async_handle.data = data->query_cbdata;
			async_send(&data->query_cbdata->async_handle);
		}
		else if( !data->is_query && data->has_udf) // query without where clause, becomes a scan background.
		{
			// generating a 32 bit random number. 
			// Because when converting to node.js integer, the last two digits precision is lost.
			// more comments on why this rand is generated here.
			data->scan_id    = 0;
			int32_t dummy_id = 0;
			srand(time(NULL));
			dummy_id = rand();
			data->scan_id = dummy_id;
			as_v8_debug(log, "The random number generated for scan_id %d ", data->scan_id);

			as_v8_debug(log, "Scan id generated is %d", data->scan_id);
			data->res = aerospike_scan_background( as, err, &data->policy.scan, data->query_scan.scan, &data->scan_id);
		}
		else if( !data->is_query && !data->has_udf)
		{
			// register the uv_async_init event here, for the scan callback to be invoked at regular interval.
			async_init(&data->query_cbdata->async_handle, async_callback);
			data->query_cbdata->async_handle.data = data->query_cbdata;
			as_v8_debug(log, "Invoking scan foreach with ");

			aerospike_scan_foreach( as, err, &data->policy.scan, data->query_scan.scan, aerospike_query_callback, (void*) data->query_cbdata); 

			// send an async signal here. If at all there's any residual records left in the queue,
			// this signal's callback will parse and send it to node layer.
			data->query_cbdata->async_handle.data = data->query_cbdata;
			async_send(&data->query_cbdata->async_handle);

		}
		else
		{
			as_v8_error(log, "Request is neither a query nor a scan ");
		}


	}
	else
	{
		as_v8_debug(log, "Parameter error - Not making the call to Aerospike Cluster");
	}

}

/**
 *  respond() — Function to be called after `execute()`. Used to send response
 *  to the callback.
 *  
 *  This function will be run inside the main event loop so it is safe to use 
 *  V8 again. This is where you will convert the results into V8 types, and 
 *  call the callback function with those results.
 */
static void respond(uv_work_t * req, int status)
{
    // Scope for the callback operation.
    NODE_ISOLATE_DECL;
    HANDLESCOPE;

    // Fetch the AsyncData structure
    AsyncData * data			= reinterpret_cast<AsyncData *>(req->data);

	AsyncCallbackData* query_data = data->query_cbdata;
    LogInfo * log				= data->log;

	if(data->param_err == 1)
	{
		Handle<Value> err_args[1] = { error_to_jsobject( &data->err, log)};
		if(  !query_data->error_cb->IsUndefined() && !query_data->error_cb->IsNull())
		{
			query_data->error_cb->Call(Context::GetCurrent()->Global(), 1, err_args);
		}
	}
	// If query returned an error invoke error callback
	if( data->res != AEROSPIKE_OK)
	{
		as_v8_debug(log,"An error occured in C API invocation");
		Handle<Value> err_args[1] = { error_to_jsobject( &data->err, log)};
		if(  !query_data->error_cb->IsUndefined() && !query_data->error_cb->IsNull())
		{
			query_data->error_cb->Call(Context::GetCurrent()->Global(), 1, err_args);
		}
	}

	// Check the queue size for zero.
	// if the queue has some records to passed to node layer,
	// Pass the record to node layer
	// If it's a query, not a background scan and query call returned AEROSPIKE_OK
	// then empty the queue.
	if( !data->is_query && data->has_udf)
	{
		as_v8_debug(log, "scan background request completed");
	}
	else if(data->res == AEROSPIKE_OK 
			&& query_data->result_q && !CF_Q_EMPTY(query_data->result_q))	
	{
		async_queue_process(query_data);
	}
	// Surround the callback in a try/catch for safety
	TryCatch try_catch;
	
	Handle<Value> argv[1];
	if( !data->is_query && data->has_udf)
	{
		as_v8_debug(log, "Invoking scan background callback with scan id %d", data->scan_id);
		argv[0] = Number::New(data->scan_id);

	}
	else
	{
		as_v8_debug(log, "Invoking query callback");
		argv[0] = String::New("Finished query!!!") ;
	}

	// Execute the callback
	if ( !query_data->end_cb->IsUndefined() && !query_data->end_cb->IsNull()) {
		query_data->end_cb->Call(Context::GetCurrent()->Global(), 1, argv);
	}

	// Process the exception, if any
	if ( try_catch.HasCaught() ) {
		node::FatalException(try_catch);
	}

	// Dispose the Persistent handle so the callback
	// function can be garbage-collected
	if( !data->is_query && data->has_udf)
	{
		as_v8_debug(log,"scan background no need to clean up the queue structure");
	}
	else 
	{
		query_data->data_cb.Dispose();
		async_close(&query_data->async_handle);
		if(query_data->result_q != NULL) 
		{
			cf_queue_destroy(query_data->result_q);
			query_data->result_q = NULL;
		}
	}
	query_data->error_cb.Dispose();
	query_data->end_cb.Dispose();


	delete query_data;
	if( !data->is_query)
	{
		cf_free(data->query_scan.scan);
	}
	delete data;
	delete req;

    as_v8_debug(log, "Query operation done");

    scope.Close(Undefined());
	return;
}

/*******************************************************************************
 *  OPERATION
 ******************************************************************************/

/**
 *  The 'query.foreach()' Operation
 */
Handle<Value> AerospikeQuery::foreach(const Arguments& args)
{
    return async_invoke(args, prepare, execute, respond);
}
