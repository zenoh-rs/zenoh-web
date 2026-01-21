---
title: "C / Pico"
weight : 6400
menu:
  docs:
    parent: migration_1.0
---

## General API changes

We have reworked the type naming to clarify how types should be interacted with.

### Owned types

Owned types are allocated by the user and it is their responsibility to drop them using `z_drop` (or `z_close` for sessions).

Previously, we were returning Zenoh structures by value. In Zenoh 1.0.0, a reference to memory must be provided. This allows initializing user allocated structures and frees return value for error codes.

Here is a quick example of this change:

- Zenoh 0.11.x

```c
z_owned_session_t session = z_open(z_move(config));
if (!z_check(session)) {
    return -1;
}
z_close(z_move(session));
```

- Zenoh 1.0.0

```c
z_owned_session_t session;
if (z_open(&session, z_move(config), &opts) < 0) {
  return -1;
}
z_close(z_move(session))
```

The owned objects have a “null” state.

- If the constructor function (e.g. `z_open`) fails, the owned object will be set to its null state.
- The `z_drop` releases the resources of the owned object and sets it to the null state to avoid double drop. Calling `z_drop` on an object in a null state is safe and does nothing.
- Calling z_drop on an uninitialized object is invalid.

Owned types support move semantics, which will consume the owned object and turn it into a moved object, see next section.

### Moved types

Moved types are obtained when using `z_move` on an owned type object. They are consumed on use when passed to relevant functions. Any non-constructor function accepting a moved object (i.e. an object passed by moved pointer) becomes responsible for calling drop on it. The object is guaranteed to be in the null state upon such function return, even if it fails.

### Loaned types

Each owned type now has a corresponding `z_loaned_xxx_t` type, which is obtained by calling

 `z_loan` or `z_loan_mut` on it, or eventually received from Zenoh functions / callbacks.

It is no longer possible to directly access the fields of an owned object that has been loaned, the accessor functions on the loaned objects should instead be used.

 Here is a quick example:

- Zenoh 0.11.x

```c
void reply_handler(z_owned_reply_t *reply, void *ctx) {
    if (z_reply_is_ok(reply)) {
        z_sample_t sample = z_reply_ok(reply);
        printf(">> Received ('%.*s')\n", (int)sample.payload.len, sample.payload.start);
    }
}
```

- Zenoh 1.0.0

```c
void reply_handler(const z_loaned_reply_t *reply, void *ctx) {
    if (z_reply_is_ok(reply)) {
        const z_loaned_sample_t *sample = z_reply_ok(reply);
        z_owned_string_t replystr;
        z_bytes_deserialize_into_string(z_sample_payload(sample), &replystr);
        printf(">> Received ('%s')\n", z_string_data(z_loan(replystr)));
    }
}
```

Certain loaned types can be copied into owned, using the `z_clone` function.
All objects that can be cloned will have a function with the signature `z_xxx_clone`. 
Please consult the docs of each type to determine if it can be copied into owned

```c
void reply_handler(const z_loaned_reply_t *reply, void *ctx) {
    some_struct_t *some_ctx = (some_struct_t *)(ctx);
    z_clone(some_ctx->query, query);
    some_ctx->has_query = true;
}
```

In the case of our callback, this allows the data from the loaned type to be used in another thread context. Note that this other thread should not forget to call `z_drop` to avoid a memory leak!

### View types

View types are only wrappers to user allocated data, like `z_view_keyexpr_t.` These types can be loaned in the same way as owned types but they don’t need to be dropped explicitly (user is fully responsible for deallocation of wrapped data).

- Zenoh 0.11.x

```c
const char *keyexpr = "example/demo/*";
z_owned_subscriber_t sub = z_declare_subscriber(z_loan(session), z_keyexpr(keyexpr), z_move(callback), NULL);
if (!z_check(sub)) {
    printf("Unable to declare subscriber.\n");
    return -1;
}
```

- Zenoh 1.0.0

```c
const char *keyexpr = "example/demo/*";
z_owned_subscriber_t sub;
z_view_keyexpr_t ke;
z_view_keyexpr_from_str(&ke, keyexpr);
if (z_declare_subscriber(z_loan(session), &sub, z_loan(ke), z_move(callback), NULL) < 0) {
    return -1;
}
```

## Payload and Serialization

Zenoh 1.0.0 handles payload differently. Before one would pass the pointer to the buffer and its length, now everything must be converted/serialized into `z_owned_bytes_t`.

Raw data in the form of null-terminated strings or buffers (i.e. `uint8_t*` + length) can be converted directly into `z_owned_bytes_t`
as follows:

- Zenoh 0.11.x

```c
int8_t send_string() {
  char *value = "Some data to publish on Zenoh";

  if (z_put(z_loan(session), z_keyexpr(ke), (const uint8_t *)value, strlen(value), NULL) < 0) {
      return -1;
  }
  return 0;
}

int8_t send_buf() {
  uint8_t *buf = (uint8_t*)z_malloc(16);
  // fill the buf
  if (z_put(z_loan(session), z_keyexpr(ke), buf, 16, NULL) < 0) {
      return -1;
  }
  return 0;
}
```

- Zenoh 1.0.0

```c
int8_t send_string() {
  char *value = "Some data to publish on Zenoh";
  z_owned_bytes_t payload;
  z_bytes_copy_from_str(&payload, value); // this copeies value to the payload

  if (z_put(z_loan(session), z_loan(ke), z_move(payload), NULL) < 0) {
    return -1;
  }
  // z_bytes_to_string can be used to convert received z_loaned_bytes_t into z_owned_string_t
  return 0;
}

void receive_string(const z_loaned_bytes_t* payload) {
  z_owned_string_t s;
  z_bytes_to_string(payload, &s);

  // do something with the string
  // raw ptr can be accessed via z_string_data(z_loan(s))
  // data length can be accessed via z_string_len(z_loan(s))

  // in the end string should be dropped since it contains a copy of the payload data
  z_drop(z_move(s));
}


int8_t void send_buf() {
  uint8_t *buf = (uint8_t*)z_malloc(16);
  // fill the buf
  z_bytes_from_buf(&payload, buf, 16, my_custom_delete_function, NULL); // this moves buf into the payload
  // my_custom_delete_function will be called to free the buf, once the corresponding data is send
  // alternatively z_bytes_copy_from_buf(&payload, buf, 16) can be used, if coying the buf is required.
  if (z_put(z_loan(session), z_loan(ke), z_move(payload), NULL) < 0) {
    return -1;
  }
  // z_bytes_to_slice can be used to convert received z_loaned_bytes_t into z_owned_slice_t
  return 0;
}

/// possible my_custom_delete_function implementation
void my_custom_delete_function(void *data, void* context) {
  // perform delete of data by optionally using extra information in the context
  free(data);
}

void receive_buf(const z_loaned_bytes_t* payload) {
  z_owned_slice_t s;
  z_bytes_to_slice(payload, &s);

  // do something with the string
  // raw ptr can be accessed via z_slice_data(z_loan(s))
  // data length can be accessed via z_slice_len(z_loan(s))

  // in the end string should be dropped since it contains a copy of the payload data
  z_drop(z_move(s));
}

```

The structured data can be serialized into `z_owned_bytes_t` by using provided serialization functionality. Zenoh provides
support for serializing arithmetic types, strings, sequences and tuples.


More comprehensive serialization/deserialization examples are provided in
https://github.com/eclipse-zenoh/zenoh-c/blob/main/examples/z_bytes.c and https://github.com/eclipse-zenoh/zenoh-pico/blob/main/examples/unix/c11/z_bytes.c.

To simplify serialization/deserialization we provide support for some primitive types like `uint8_t*` + length, null-terminated strings and arithmetic types.
Primitive types can be serialized directly into `z_owned_bytes_t`:
```c
// Serialization
uint32_t input_u32 = 1234;
ze_serialize_uint32(&payload, input_u32);

// Deserialization
uint32_t output_u32 = 0;
ze_deserialize_uint32(z_loan(payload), &output_u32);
// now output_u32 = 1234
z_drop(z_move(payload));

```
while tuples and/or arrays require usage of `ze_owned_serializer_t` and `ze_deserializer_t`:
```c
typedef struct my_struct_t {
  float f;
  int32_t n;
} my_struct_t;

...

// Serialization
my_struct_t input_vec[] = {{1.5f, 1}, {2.4f, 2}, {-3.1f, 3}, {4.2f, 4}};
ze_owned_serializer_t serializer;
ze_serializer_empty(&serializer);
ze_serializer_serialize_sequence_length(z_loan_mut(serializer), 4);
for (size_t i = 0; i < 4; ++i) {
  ze_serializer_serialize_float(z_loan_mut(serializer), input_vec[i].f);
  ze_serializer_serialize_int32(z_loan_mut(serializer), input_vec[i].n);
}
ze_serializer_finish(z_move(serializer), &payload);

// Deserialization
my_struct_t output_vec[4] = {0};
ze_deserializer_t deserializer = ze_deserializer_from_bytes(z_loan(payload));
size_t num_elements = 0;
ze_deserializer_deserialize_sequence_length(&deserializer, &num_elements);
assert(num_elements == 4);
for (size_t i = 0; i < num_elements; ++i) {
  ze_deserializer_deserialize_float(&deserializer, &output_vec[i].f);
  ze_deserializer_deserialize_int32(&deserializer, &output_vec[i].n);
}
// now output_vec = {{1.5f, 1}, {2.4f, 2}, {-3.1f, 3}, {4.2f, 4}}
z_drop(z_move(payload));
```


To implement custom (de-)serialization, Zenoh 1.0.0 provides `ze_owned_bytes_serializer`, `ze_bytes_deserializer_t` or lower-level `z_owned_bytes_wrtiter_t` and `z_bytes_reader_t` types and corresponding functions.

Note that it is no longer possible to access the underlying payload data pointer directly, since Zenoh cannot guarantee that the data is delivered as a single fragment.
So in order to get access to raw payload data one must use either `z_bytes_reader_t` or alternatively `z_bytes_slice_iterator_t` and their related functions:

```c
z_bytes_reader_t reader = z_bytes_get_reader(z_loan(payload));
uint8_t data1[10] = {0};
uint8_t data2[20] = {0};

z_bytes_reader_read(&reader, data1, 10); // copy first 10 payload bytes to data1
z_bytes_reader_read(&reader, data2, 20); // copy next 20 payload bytes to data2

// or
z_bytes_slice_iterator_t slice_iter = z_bytes_get_slice_iterator(z_bytes_loan(&payload));
z_view_slice_t curr_slice;
while (z_bytes_slice_iterator_next(&slice_iter, &curr_slice)) {
  // curr_slice provides a view on the corresponding fragment bytes.
  // Note that there is no guarantee regarding each individual slice size
}
```

## Channel Handlers and Callbacks

In version 0.11.0 Channel handlers were only supported for `z_get`and `z_owned_queryable_t`:

```c
// callback
z_owned_closure_reply_t callback = z_closure(reply_handler);
z_get(z_loan(session), z_keyexpr(keyexpr), "", z_move(callback), &opts);

// Channel handlers interface
// blocking
z_owned_reply_channel_t channel = zc_reply_fifo_new(16);
z_get(z_loan(session), z_keyexpr(keyexpr), "", z_move(channel.send), &opts);
z_owned_reply_t reply = z_reply_null();
for (z_call(channel.recv, &reply); z_check(reply); z_call(channel.recv, &reply)) {
  if (z_reply_is_ok(&reply)) {
    z_sample_t sample = z_reply_ok(&reply);
    // do something with sample and keystr
  } else {
    printf("Received an error\n");
  }
  z_drop(z_move(reply));
}
z_drop(z_move(channel));

// non-blocking
z_owned_reply_channel_t channel = zc_reply_non_blocking_fifo_new(16);
z_get(z_loan(s), keyexpr, "", z_move(channel.send), &opts);
z_owned_reply_t reply = z_reply_null();
for (bool call_success = z_call(channel.recv, &reply); !call_success || z_check(reply);
  call_success = z_call(channel.recv, &reply)) {
  if (!call_success) {
    continue;
  }
  if (z_reply_is_ok(z_loan(reply))) {
    const z_loaned_sample_t *sample = z_reply_ok(&reply);
    // do something with sample
  } else {
    printf("Received an error\n");
  }
  z_drop(z_move(reply));
}
z_drop(z_move(channel));
```

In 1.0.0, `z_owned_subscriber_t`, `z_owned_queryable_t` and `z_get` can use either a callable object or a stream handler. In addition, the same handler type now provides both a blocking and non-blocking interface. For the time being Zenoh provides 2 types of handlers:

- `FifoHandler` - serving messages in Fifo order, *dropping new messages* once full. It is worth noting that it will drop new messages only if the queue is full and the default multi-thread feature is disabled.
- `RingHandler` - serving messages in Fifo order, *dropping older messages* once full to make room for new ones.

```c
// callback
z_owned_closure_reply_t callback = z_closure(reply_handler);
z_get(z_loan(session), z_keyexpr(keyexpr), "", z_move(callback), &opts);

// stream handlers interface
z_owned_fifo_handler_reply_t handler;
z_owned_closure_reply_t closure;
z_fifo_channel_reply_new(&closure, &handler, 16);
z_get(z_loan(s), z_loan(keyexpr), "", z_move(closure), z_move(opts));
z_owned_reply_t reply;

// blocking
while (z_recv(z_loan(handler), &reply) == Z_OK) {
  // z_recv will block until there is at least one sample in the Fifo buffer
  if (z_reply_is_ok(z_loan(reply))) {
    const z_loaned_sample_t *sample = z_reply_ok(z_loan(reply));
    // do something with sample
  } else {
    printf("Received an error\n");
  }
  z_drop(z_move(reply));
}

// non-blocking
while (true) {
  z_result_t res = z_try_recv(z_loan(handler), &reply);
  if (res == Z_CHANNEL_NODATA) {
    // z_try_recv is non-blocking call, so will fail to return a reply if the Fifo buffer is empty
    // do some other work or just sleep
  } else if (res == Z_OK) {
    if (z_reply_is_ok(z_loan(reply))) {
      const z_loaned_sample_t *sample = z_reply_ok(z_loan(reply));
      // do something with sample
    } else {
      printf("Received an error\n");
    }
    z_drop(z_move(reply));
  } else { // res == Z_CHANNEL_DISCONNECTED
    break; // channel is closed - no more replies will arrive
  }
}

```

The same now also works for `Subscriber` and `Queryable` :

```c
// callback
void data_handler(const z_loaned_sample_t *sample, void *context) {
  // do something with sample
}

z_owned_closure_sample_t callback;
z_closure(&callback, data_handler, NULL, NULL);
z_owned_subscriber_t sub;
if (z_declare_subscriber(z_loan(session), &sub, z_loan(keyexpr), z_move(callback), NULL) < 0) {
  printf("Unable to declare subscriber.\n");
  exit(-1);
}

// stream handlers interface
z_owned_fifo_handler_sample_t handler;
z_owned_closure_sample_t closure;
z_fifo_channel_reply_new(&closure, &handler, 16);
z_owned_subscriber_t sub;
if (z_declare_subscriber(z_loan(session), &sub, z_loan(keyexpr), z_move(closure), NULL) < 0) {
  printf("Unable to declare subscriber.\n");
  exit(-1);
}

z_owned_sample_t sample;
// blocking
while (z_recv(z_loan(handler), &sample) == Z_OK) {
    // z_recv will block until there is at least one sample in the Fifo buffer
    // it will return an empty sample and is_alive=false once subscriber gets disconnected

    // do something with sample
    z_drop(z_move(sample));
}

// non-blocking
while (true) {
  z_result_t res = z_try_recv(z_loan(handler), &sample);
  if (res == Z_CHANNEL_NODATA) {
    // z_try_recv is non-blocking call, so will fail to return a sample if the Fifo buffer is empty
    // do some other work or just sleep
  } else if (res == Z_OK) {
    // do something with sample
    z_drop(z_move(sample));
  } else { // res == Z_CHANNEL_DISCONNECTED
    break; // channel is closed - no more samples will be received
  }
}
```

The `z_owned_pull_subscriber_t` was removed, given that `RingHandler` can provide similar functionality with ordinary `z_owned_subscriber_t.`
Since the callback in 1.0.0. carries a loaned sample whenever it is triggered, we can save an explicit drop on the sample now.

## Attachment

In 0.11.0, attachments were a separate type and could only be a set of key-value pairs:

```c
// publish message with attachment
char *value = "Some data to publish on Zenoh";

z_put_options_t options = z_put_options_default();
z_owned_bytes_map_t map = z_bytes_map_new();
z_bytes_map_insert_by_alias(&map, _z_bytes_wrap((uint8_t *)"test", 2), _z_bytes_wrap((uint8_t *)"attachment", 5));
options.attachment = z_bytes_map_as_attachment(&map);

if (z_put(z_loan(s), z_keyexpr(keyexpr), (const uint8_t *)value, strlen(value), &options) < 0) {
  return -1;
}

z_bytes_map_drop(&map);

// receive sample with attachment

int8_t attachment_reader(z_bytes_t key, z_bytes_t val, void* ctx) {
  printf("   attachment: %.*s: '%.*s'\n", (int)key.len, key.start, (int)val.len, val.start);
  return 0;
}

void data_handler(const z_sample_t* sample, void* arg) {
  // checks if attachment exists
  if (z_check(sample->attachment)) {
    // reads full attachment
    z_attachment_iterate(sample->attachment, attachment_reader, NULL);

    // reads particular attachment item
    z_bytes_t index = z_attachment_get(sample->attachment, z_bytes_from_str("index"));
    if (z_check(index)) {
      printf("   message number: %.*s\n", (int)index.len, index.start);
    }
  }
  z_drop(z_move(keystr));
}

```

In 1.0.0, attachments were greatly simplified. They are now represented as `z_..._bytes_t` (i.e. the same type we use to represent payload data) and can thus contain data in any format.

```c
// publish attachment
typedef struct {
  char* key;
  char* value;
} kv_pair_t;

...

kv_pair_t attachment_kvs[2] = {;
  (kv_pair_t){.key = "index", .value = "1"},
  (kv_pair_t){.key = "source", .value = "C"}
}

z_owned_bytes_t payload, attachment;
// serialize key value pairs as attachment

ze_owned_serializer_t serializer;
ze_serializer_empty(&serializer);
ze_serializer_serialize_sequence_length(z_loan_mut(serializer), 2);
for (size_t i = 0; i < 2; ++i) {
    ze_serializer_serialize_str(z_loan_mut(serializer), attachment_kvs[i].key);
    ze_serializer_serialize_str(z_loan_mut(serializer), attachment_kvs[i].value);
}
ze_serializer_finish(z_move(serializer), &payload);
options.attachment = &attachment;

z_bytes_copy_from_str(&payload, "payload");
z_publisher_put(z_loan(pub), z_move(payload), &options);

// receive sample with attachment

void data_handler(const z_loaned_sample_t *sample, void *arg) {
  z_view_string_t key_string;
  z_keyexpr_as_view_string(z_sample_keyexpr(sample), &key_string);

  z_owned_string_t payload_string;
  z_bytes_deserialize_into_string(z_sample_payload(sample), &payload_string);

  printf(">> [Subscriber] Received %s ('%.*s': '%.*s')\n", kind_to_str(z_sample_kind(sample)),
   (int)z_string_len(z_loan(key_string)), z_string_data(z_loan(key_string)),
   (int)z_string_len(z_loan(payload_string)), z_string_data(z_loan(payload_string)));
  z_drop(z_move(payload_string));

  const z_loaned_bytes_t *attachment = z_sample_attachment(sample);
  // checks if attachment exists
  if (attachment == NULL) {
    return;
  }

  // read attachment key-value pairs using bytes_iterator
  ze_deserializer_t deserializer = ze_deserializer_from_bytes(z_loan(payload));
  size_t num_elements = 0;
  ze_deserializer_deserialize_sequence_length(&deserializer, &num_elements);
  z_owned_string_t key, value;
  for (size_t i = 0; i < num_elements; ++i) {
    ze_deserializer_deserialize_string(&deserializer, &key);
    ze_deserializer_deserialize_string(&deserializer, &value);
    printf("   attachment: %.*s: '%.*s'\n",
      (int)z_string_len(z_loan(key)), z_string_data(z_loan(key)),
      (int)z_string_len(z_loan(value)), z_string_data(z_loan(value)));
    z_drop(z_move(key));
    z_drop(z_move(value));
  }
}
```

## Encoding

Encoding handling has been reworked: before one would use an enum id and a string suffix value, now only the encoding metadata needs to be registered using `z_encoding_from_str`.

There is a set of predefined constant encodings subject to some wire-level optimization. To benefit from this, the provided encoding should follow the format: `"<predefined constant>;<optional additional data>"`

All predefined constants provided can be found in here [Encoding Variants](https://github.com/eclipse-zenoh/zenoh-pico/blob/10ddde219be41fc0b43bad4d19f571625a27c161/src/api/api.c#L218-L285)


- Zenoh 0.11.x

```c
char *value = "Some data to publish on Zenoh";
z_put_options_t options = z_put_options_default();
options.encoding = z_encoding(Z_ENCODING_PREFIX_TEXT_PLAIN, "utf8");

if (z_put(z_loan(session), z_keyexpr(ke), (const uint8_t *)value, strlen(value), &options) < 0) {
    return -1;
}
```

- Zenoh 1.0.0

```c
char *value = "Some data to publish on Zenoh";
z_owned_bytes_t payload;
z_bytes_serialize_from_str(&payload, value);

z_publisher_put_options_t options;
z_publisher_put_options_default(&options);
z_encoding_from_str(&encoding, "text/plain;utf8");
options.encoding = z_move(encoding);

if (z_put(z_loan(session), z_loan(ke), z_move(payload), &options) < 0) {
  return -1;
}
```

## Timestamps

The generation of timestamps is now tied to a Zenoh session, with the timestamp inheriting the `ZenohID` of the session.

- Zenoh 0.11.x

```c
// Didn't exist
```

- Zenoh 1.0.0

```c
z_timestamp_t ts;
z_timestamp_new(&ts, z_loan(s));
options.timestamp = &ts;
z_publisher_put(z_loan(pub), z_move(payload), &options);
```

## Error Handling

In 1.0.0, we unified the return type of Zenoh functions as `z_result_t`. For example,

- Zenoh 0.11.x
```c
int8_t z_put(struct z_session_t session,
             struct z_keyexpr_t keyexpr,
             const uint8_t *payload,
             size_t len,
             const struct z_put_options_t *opts);

```

- Zenoh 1.0.0

```c
z_result_t z_put(const struct z_loaned_session_t *session,
                 const struct z_loaned_keyexpr_t *key_expr,
                 struct z_owned_bytes_t *payload,
                 struct z_put_options_t *options);

```

## KeyExpr / String Conversion

In 1.0.0, we have reworked the conversion between key expressions and strings, illustrated below.

- Zenoh 0.11.x

```c
// keyexpr => string
z_owned_str_t keystr = z_keyexpr_to_string(z_loan(z_owned_keyexpr_t));

// keyexpr => const char *
z_loan(keystr)

// const char* => keystr
z_owned_keyexpr_t keyexpr = z_keyexpr_new(const char*)

```

- Zenoh 1.0.0

```c
// keyexpr => string
z_view_string_t keystr;
z_keyexpr_as_view_string(z_loan(z_owned_keyexpr_t), &keystr);

// z_view_string_t  => const char*
z_string_data(z_loan(keystr))

// const char* => keystr
z_owned_keyexpr_t keyexpr;
z_error_t res = z_keyexpr_from_string(&keyexpr, const char *);

```

NOTE: Based on efficiency considerations, the char pointer of `z_string_data` might not be null-terminated in zenoh-c. To read the string data, we need to pair it with the length `z_string_len`.

```c
z_view_str_t keystr;
z_keyexpr_as_view_string(z_loan(keyexpr), &keystr);
printf("%.*s", (int)z_string_len(z_loan(keystr)), z_string_data(z_loan(keystr)));
```

And to compare the string with `strncmp` instead of `strcmp`.

```c
z_view_str_t keystr;
z_keyexpr_as_view_string(z_loan(keyexpr), &keystr);
const char* target = "string";
strncmp(target, z_string_data(z_loan(keystr)), z_string_len(z_loan(keystr)));
```

## Accessor Pattern

In 1.0.0, we have made our API more convenient and consistent to use across languages. We use opaque types to wrap the raw Zenoh data from the Rust library in zenoh-c. With this change, we introduce the accessor pattern to read the field of a struct.

For instance, to get the attachment of a sample in zenoh-c:

- 0.11.0

```c
typedef struct z_sample_t {
  struct z_keyexpr_t keyexpr;
  struct z_bytes_t payload;
  struct z_encoding_t encoding;
  const void *_zc_buf;
  enum z_sample_kind_t kind;
  struct z_timestamp_t timestamp;
  struct z_qos_t qos;
  struct z_attachment_t attachment;
} z_sample_t;
```

- 1.0.0

Opaque type of `z_sample`

```rust
/// An owned Zenoh sample.
///
/// This is a read only type that can only be constructed by cloning a `z_loaned_sample_t`.
/// Like all owned types, it should be freed using z_drop or z_sample_drop.
#[derive(Copy, Clone)]
#[repr(C, align(8))]
pub struct z_owned_sample_t {
    _0: [u8; 224],
}
/// A loaned Zenoh sample.
#[derive(Copy, Clone)]
#[repr(C, align(8))]
pub struct z_loaned_sample_t {
    _0: [u8; 224],
}
```

Get attachment

```c
const struct z_loaned_bytes_t *z_sample_attachment(const struct z_loaned_sample_t *this_);
```

In zenoh-pico, we recommend users follow the accessor pattern even though the struct `z_sample_t` is explicitly defined in the library.

## Usage of `z_bytes_clone`

In short, `z_owned_bytes_t` is made of reference-counted data slices. In 1.0.0, we aligned the implementation of `z_bytes_clone` and made it perform a shallow copy for improved efficiency.

- Zenoh 0.11.x

```c
ZENOHC_API struct zc_owned_payload_t zc_sample_payload_rcinc(const struct z_sample_t *sample);
```

- Zenoh 1.0.0

```c
ZENOHC_API void z_bytes_clone(struct z_owned_bytes_t *dst, const struct z_loaned_bytes_t *this_);
```

NOTE: We don't offer a deep copy API. However, users can create a deep copy by deserializing the `z_bytes_t` into a zenoh object. For example, use `z_bytes_deserialize_into_slice` to deserialize it into a `z_owned_slice_t` and then call `z_slice_data` to obtain a pointer to `uint8_t` data.

## Zenoh-C Specific

### Shared Memory

Shared Memory subsystem has been heavily reworked and improved. The key functionality changes are:

- Buffer reference counting is now robust across abnormal process termination
- Support plugging of user-defined SHM implementations
- Dynamic SHM transport negotiation: Sessions are interoperable with any combination of SHM configuration and physical location
- Support aligned allocations
- Manual buffer invalidation
- Buffer write access
- Rich buffer allocation interface

⚠️ Please note that SHM API is still unstable and will be improved in the future.

### SharedMemoryManager → ShmProvider + ShmProviderBackend

- Zenoh 0.11.x

```c
// size to dedicate to SHM manager
const size_t size = 1024 * 1024;
// construct session id string
const z_id_t id = z_info_zid(z_loan(s));
char idstr[33];
for (int i = 0; i < 16; i++) {
  sprintf(idstr + 2 * i, "%02x", id.id[i]);
}
idstr[32] = 0;
// create SHM manager
zc_owned_shm_manager_t manager = zc_shm_manager_new(z_loan(s), idstr, size);
```

- Zenoh 1.0.0

```c
// size to dedicate to SHM provider
const size_t total_size = 1024 * 1024;

// Difference: SHM provider now respects alignment
z_alloc_alignment_t alignment = {0};
z_owned_memory_layout_t layout;
z_memory_layout_new(&layout, total_size, alignment);

// create SHM provider
z_owned_shm_provider_t provider;
z_posix_shm_provider_new(&provider, z_loan(layout));
```

### Buffer allocation

- Zenoh 0.11.x

```c
// buffer size
const size_t alloc_size = 1024;

// allocate SHM buffer
zc_owned_shmbuf_t shmbuf = zc_shm_alloc(&manager, alloc_size);
if (!z_check(shmbuf)) {
    zc_shm_gc(&manager);
    shmbuf = zc_shm_alloc(&manager, alloc_size);
    if (!z_check(shmbuf)) {
        printf("Failed to allocate an SHM buffer, even after GCing\n");
        exit(-1);
    }
}
```

- Zenoh 1.0.0

```c
// buffer size and alignment
const size_t alloc_size = 1024;
// Difference: allocation now respects alignment
z_alloc_alignment_t alignment = {0};

// allocate SHM buffer
z_buf_layout_alloc_result_t alloc;
// Difference: there is a rich set of policies available to control
// allocation behavior and handle allocation failures automatically
z_shm_provider_alloc_gc(&alloc, z_loan(provider), alloc_size, alignment);
if (!z_check(alloc.buf)) {
  printf("Failed to allocate an SHM buffer, even after GCing\n");
  exit(-1);
}
```
