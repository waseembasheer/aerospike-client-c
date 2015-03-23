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

#include <node.h>
#include "enums.h"

using namespace v8;

#define set(__obj, __name, __value) __obj->Set(NanNew(__name), NanNew(__value))

Handle<Object> scanStatus() 
{
    NanEscapableScope();
    Handle<Object> obj = NanNew<Object>();
    set(obj, "UNDEF",    0);
    set(obj, "INPROGRESS",     1);
    set(obj, "ABORTED",  2);
    set(obj, "COMPLETED",    3);
    return NanEscapeScope(obj);
}
