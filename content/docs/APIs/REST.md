---
title: "REST API"
weight: 4400
menu:
  docs:
    parent: APIs
---

Zenoh also offers a REST API via the zenoh-rest plugin. When starting Zenoh with default options,
this REST plugin is automatically started on port 8000 and ready to answer HTTP requests.  
The full Zenoh key/value space is accessible via this REST API, including the Admin Space under the `'@'`prefix.

### GET

Binds to the **get(selector)** operation on Zenoh.

- **URL**: `http://host:8000/<selector>`
- **body**: none
- **headers**: none

The results are returned as a JSON array of objects containing `"key"`, `"value"`and `"time"`.

Examples using curl:

```bash
# Get the keys/values matching demo/**
$ curl http://localhost:8000/demo/**
[
{ "key": "demo/example/zenoh-python-put",
  "value": "Put from Python!",
  "encoding": "text/plain",
  "time": "2022-03-29T10:19:38.988830998Z/BC99B84DD73D449FB7B5C03506934604" },
{ "key": "demo/example/zenoh-c-put",
  "value": "Put from Python!",
  "encoding": "text/plain",
  "time": "2022-03-29T10:19:40.031682968Z/BC99B84DD73D449FB7B5C03506934604" },
{ "key": "demo/example/zenoh-rs-put",
  "value": "Put from Python!",
  "encoding": "text/plain",
  "time": "2022-03-29T10:19:45.879540920Z/BC99B84DD73D449FB7B5C03506934604" },
]

# Get the keys/values matching demo/example/*eval (i.e. the Zenoh eval examples)
# with property name=Bob
$ curl http://localhost:8000/demo/example/*eval?(name=Bob)
[
{ "key": "demo/example/zenoh-rs-eval",
  "value": "Eval from Bob",
  "encoding": "text/plain",
  "time": "None" }
]

# Get the list of storages via a Get on admin space (@/...)
$ curl -g http://localhost:8000/@/**/storages/**
[
{ "key": "@/router/BC99B84DD73D449FB7B5C03506934604/status/plugins/storage_manager/storages/demo",
  "value": {"key_expr":"demo/example/**","volume":"memory"},
  "encoding": "application/json",
  "time": "None" }
]
```

### Long-lived (SSE) GET

Binds to the **declare_subscriber(key_expression)** operation on Zenoh.

- **URL**: `http://host:8000/<key_expression>`
- **body**: none
- **headers**: `Accept: text/event-stream`

The connection will be upgraded to an SSE (Server-Sent Events), letting Zenoh keep on forwarding samples matching your key expressions in JSON format.

### PUT

Binds to the **put(keyexpr, value)** operation on Zenoh.

- **URL**: `http://host:8000/<keyexpr>`
- **body**: the value to put
- **headers**: 
   - **content-type**: the value encoding (optional; unspecified implies "application/octet-stream" encoding. Note that curl by default uses "application/x-www-form-urlencoded")

The values with the following content-types will be automatically converted by Zenoh into a typed Value:

| content-type             | Zenoh Value type |
| ------------------------ | ---------------- |
| text/plain               | TextPlain        |
| application/properties   | AppProperties    |
| application/json         | AppJson          |
| text/json                | TextJson         |
| application/integer      | AppInteger       |
| application/float        | AppFloat         |

Examples using curl:

  ```bash
  # Put a string value in demo/example/test
  curl -X PUT -H "content-type:text/plain" -d 'Hello World!' http://localhost:8000/demo/example/test

  # Put a JSON value in demo/example/json
  curl -X PUT -H "content-type:application/json" -d '{"value": "Hello World!"}' http://localhost:8000/demo/example/test

  # Create a Memory storage on demo/test/** via a Put on admin space (@/...)
  curl -X PUT -H 'content-type:application/json' http://localhost:8000/@/local/router/config/plugins/storage_manager/storages/demo -d '{key_expr:"demo/test/**", volume:"memory"}' 
  ```

### DELETE

Binds to the **remove(keyexpr)** operation on Zenoh.

- **URL**: `http://host:8000/<keyexpr>`
- **body**: none
- **headers**: none

Examples using curl:

  ```bash
  # Remove the value with key demo/example/test
  curl -X DELETE http://localhost:8000/demo/example/test

  # Remove a storage via a Remove on admin space (@/...)
  curl -X DELETE http://localhost:8000/@/local/router/config/plugins/storage_manager/storages/demo
  ```

