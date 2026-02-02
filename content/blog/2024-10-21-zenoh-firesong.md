---
date: "2024-10-01"
title: 'Zenoh 1.0.0 "Firesong" is ready to rock!'
description: "21st October 2024"
menu: "blog"
weight: 20241021
---

As a result of an incredible effort from the whole Zenoh team and Zenoh community, we can finally announce that Zenoh 1.0.0 *Firesong* is out! 

{{< figure-inline
    src="../../img/20241021-blog-zenoh-firesong/comic-october-2024.png"
    class="responsive-figure figure-inline"
    alt="Zenoh comic October 2024"
    width="100%" >}}

{{< rawhtml >}}

<style>
.responsive-figure {
    display: flex;
    justify-content: center;
}

.responsive-figure img {
    max-width: 720px;
    height: auto;
}
</style>

{{< /rawhtml >}}

This release marks an incredible milestone for Zenoh and comes with a lot of features and improvements:
- API stabilization. Great attention has been given to the API, its revision and rework to provide the necessary level of stability and future extensibility.
- The very first alpha version of the new TypeScript API.
- A full rework of the Shared Memory subsystem in Zenoh, with a new API and more supported topologies.
- Improved batching and jitter performance for high frequency publications.
- Improved protocol for write-side filtering.

Let us take a closer look at what Zenoh 1.0.0 brings to the table.

---

## Improved API approach

Zenoh's API has been improved in terms of ergonomics, clarity, and composability for future extensibility! 
The following sections highlight the main changes of the API in the various language bindings. 
The full migration guide of each language is available [here](https://zenoh.io/docs/migration_1.0/concepts/).

### Accessors

To better separate the public API from the internal implementation, we have introduced the accessor pattern in the Zenoh API across all language bindings. 
See an example in Rust below. 
Please note that the same approach would apply to all Zenoh APIs.

Zenoh 0.11.0:
```rust
while let Ok(sample) = subscriber.recv_async().await {
    println!(
        ">> [Subscriber] Received {} ('{}': '{}')",
        sample.kind,
        sample.key_expr.as_str(),
    );
}
```

Zenoh 1.0.0:
```rust
while let Ok(sample) = subscriber.recv_async().await {
    println!(
        ">> [Subscriber] Received {} ('{}': '{}')",
        sample.kind(),
        sample.key_expr().as_str(),
    );
}
```

### ZBytes

`Value` was a type that contained a payload (`ZBuf`) and some metadata about the `Encoding`. It was generally accepted in functions like `put()` and `reply()`. 
Zenoh 1.0.0 deprecates `Value` in favour of explicitly separating `ZBytes` and `Encoding` in the API. This has the benefit of improving API and network overhead. 

`ZBytes` is the core type for raw data representation in Zenoh. 
All API has been reworked to accept `ZBytes` or a type that can be transparantely converted into a `ZBytes`, such as a string.
Sample’s payloads are now `ZBytes`. `Publisher`, `Queryable` and `Subscriber` now expect `ZBytes` for all their interfaces.
The Attachment API also now accepts `ZBytes`.

Zenoh 0.11.0:
```rust
// Publisher
// “My Value” is converted in bytes and the “string” encoding was automatically set
session.put(“test/foo”, “My Value”).res().await.unwrap(); 

// Subscriber
// Data can be accessed directly and encoding metadata is not required to be checked
// Some bandwidth was wasted for nothing
let string = String::from_utf8_lossy(sample.value.contiguous());
```

Zenoh 1.0.0:
```rust
// Publisher
// “My Value” is a string that can be directly converted in bytes, no encoding is automatically set
session.put(“test/foo”, “My Value”).attachment(“My attachment”).await.unwrap(); 

// Subscriber
// Convert data type using
let string = String::from_utf8_lossy(&sample.payload().to_bytes());
let value = sample.payload().try_to_string().unwrap();
let attach = sample.attachment().try_to_string().unwrap();
```

It is worth highlighting that Zenoh semantics and protocol take care of sending and receiving bytes without restricting the actual data types.
Nonetheless, in the spirit of always improving user's life with a simple out-of-the-box experience, we have added a number of optional serializer/deserializer to deal with language primitive types (e.g., integeres, floats, tuples, etc.).
This serializer/deserializer is NOT by any means the only serializer/deserializer users can use nor a limitation to the types supported by Zenoh. 
Users are free and encouraged to use any serializer/deserializer of their choice like JSON, protobuf, bincode, flatbuffers, etc. 

```rust
use zenoh_ext::{z_deserialize, z_serialize};

// Numeric types: u8, u16, u32, u128, i8, i16, i32, i128, f32, f64
let input = 1234_u32;
let payload = z_serialize(&input);
let output: u32 = z_deserialize(&payload).unwrap();
assert_eq!(input, output);

// Vec
let input = vec![0.0f32, 1.5, 42.0];
let payload = z_serialize(&input);
let output: Vec<f32> = z_deserialize(&payload).unwrap();
assert_eq!(input, output);

// HashMap
let mut input: HashMap<u32, String> = HashMap::new();
input.insert(0, String::from("abc"));
input.insert(1, String::from("def"));
let payload = z_serialize(&input);
let output: HashMap<u32, String> = z_deserialize(&payload).unwrap();
assert_eq!(input, output);

// Tuple
let input = (0.42f64, "string".to_string());
let payload = z_serialize(&input);
let output: (f64, String) = z_deserialize(&payload).unwrap();
assert_eq!(input, output);

// Array (handled as variable-length sequence, not as tuple)
let input = [0.0f32, 1.5, 42.0];
let payload = z_serialize(&input);
let output: [f32; 3] = z_deserialize(&payload).unwrap();
assert_eq!(input, output);
// can also be deserialized as a vec
let output: Vec<f32> = z_deserialize(&payload).unwrap();
assert_eq!(input.as_slice(), output);
```

You can have a look at the [z_bytes example](https://github.com/eclipse-zenoh/zenoh/blob/main/examples/examples/z_bytes.rs) for additional examples.

### Encoding

`Encoding` has been reworked, moving away from enumerables to now accepting strings.
While Zenoh does not impose any `Encoding` requirement on the user, providing an `Encoding` can offer automatic wire-level optimization for known types.  
For the user defined `Encoding`, it can be thought of as optional metadata, carried over by Zenoh in such a way that the end user’s application may perform different operations based on `Encoding`.  
We have expanded our list of predefined encoding types from Zenoh 0.11.0 to include variants for numerous IANA standard encodings, including but not limited to  `video/x` , `application/x`, `text/x`, `image/x` and `audio/x` encoding families, as well as an encoding family specific to Zenoh defined by the prefix `zenoh/x` .   
Users can also define their own encoding scheme that does not need to be based on the predefined IANA variants. 

```rust
// Publisher
// Encoding::TEXT_PLAIN is a convenience constant equivalent to “text/plain”
session.put(“test/foo”, “My Value”).encoding(Encoding::TEXT_PLAIN).await.unwrap();

// Subscriber
if sample.encoding() == Encoding::TEXT_PLAIN {
    let s = sample.payload().try_to_string().unwrap()
}
```

Example of using custom encoding:

```rust
// Publisher
// Encoding::TEXT_PLAIN is a convenience constant equivalent to “text/plain”
session.put(“test/foo”, vec![0u8; 64]).encoding(“my_encoding”).await.unwrap();

// Subscriber
if &sample.encoding().to_string() == “my_encoding” {
    let reader = sample.payload().reader();
    // Deserialize the type according to the encoding
}
```

### Query & Queryable
The `reply` method of a `Queryable` has gained two variants: 
- `reply_del` to indicate that a deletion should be performed.
- `reply_err` to indicate that an error occurred.   

Additionally, these variants behave similarly to `put` and `del`, providing improved ergonomics.

We have added the ability to get the underlying `Handler` of a Queryable as well.

```rust
// Queryable
while let Ok(query) = queryable.recv_async().await {
    query
        .reply(key_expr.clone(), payload.clone())
         // Or reply with a delete
         // .reply_del(key_expr.clone())
         // Or reply with an error
         // .reply_err(“My error”)
        .await
        .unwrap();
}

// Querier
let replies = session.get(“test/foo”).await.unwrap();

while let Ok(reply) = replies.recv_async().await {
    match reply.result() {
        Ok(sample) => match sample.kind() {
            SampleKind::Put => { /* Handle .reply() */ },
            SampleKind::Del => { /* Handle .reply_del() */ },
        },
        Err(err) => { /* Handle .reply_err() and any infrastructure error */  }
    }
}
```

### Timestamps

Zenoh timestamps are based on an [Unique Hybrid Logical Clock](https://github.com/atolab/uhlc-rs), which is largely used in the Zenoh Storage Alignment protocol. One of the requirements for the alignment protocol is to be able to uniquely identify who published the data and consequently who generated the timestamp. Zenoh 0.11.0 exposed a function to generate timestamps outside of a session, which could be used in a Zenoh system. Due to our efforts to improve the storage replication logic, now timestamps are generated from a session, with the timestamp inheriting the `ZenohID` of the session. Users are not expected to generate timestamps by themselves but rather to rely on the [timestamping functionality](https://github.com/eclipse-zenoh/zenoh/blob/6b7ec55911ce85a243c6eae857cbddd7ab1d0021/DEFAULT_CONFIG.json5#L133) of Zenoh.

### Ring channel

A pull subscriber was mainly used to pull the latest data available for a given subscriber. 
In Zenoh 1.0.0, we have removed the pull subscriber as part of some rework to streamline the API and the protocol. 
This leads to the fact that only one type of subscriber exists. 
However, to keep the functionality of being able to pull the last data, we have added a `RingChannel` for the subscriber (as well as for the queryable and get) that can be used to get a similar behaviour. 
Once full, the `RingChannel` will replace older data with most recent ones. This contrasts with the `FIFOChannel`, the default channel type used by Subscribers, which blocks once its buffer is full. 

Publisher example:
```rust
#[tokio::main]
async fn main() {
    let session = zenoh::open(Config::default()).await.unwrap();
    let publisher = session.declare_publisher(“test/foo”).await.unwrap();
    // Publish a message every second
    for idx in 0..10 {
        tokio::time::sleep(Duration::from_secs(1)).await;
        let buf = format!("[{idx:4}] Pub from Rust!");
        println!("{}", buf);
        publisher
            .put(buf)
            .await
            .unwrap();
    }
}
```

Subscriber example with FifoChannel (default):
```rust
#[tokio::main]
async fn main() {
    let session = zenoh::open(Config::default()).await.unwrap();
    let subscriber = session.declare_subscriber(“test/foo”).await.unwrap();
    while let Ok(sample) = subscriber.recv_async().await {
        let payload = sample
            .payload()
            .try_to_string()
            .unwrap_or_else(|e| format!("{}", e));
        println!(“{}”, payload); // No long computation
    }
}
```

Subscriber example with RingChannel:
```rust
#[tokio::main]
async fn main() {
    let session = zenoh::open(Config::default()).await.unwrap();
    let subscriber = session
             .declare_subscriber(“test/foo”)
             .with(RingChannel::new(5))
             .await
             .unwrap();
    while let Ok(sample) = subscriber.recv_async().await {
        let payload = sample
            .payload()
            .try_to_string()
            .unwrap_or_else(|e| format!("{}", e));
        println!(“{} Sleeping for 5s.”, payload); 
        tokio::time::sleep(Duration::from_secs(5)).await; // Long computation
    }
}
```

You can take a look at examples of usage in any language’s *examples/z_pull.x*.
The output of the publisher will look like this with a publication made every second. 
```sh
$ ./z_pub
[   0] Pub from Rust!
[   1] Pub from Rust!
[   2] Pub from Rust!
[   3] Pub from Rust!
[   4] Pub from Rust!
[   5] Pub from Rust!
[   6] Pub from Rust!
[   7] Pub from Rust!
[   8] Pub from Rust!
[   9] Pub from Rust!
[  10] Pub from Rust!
```

Since *z_sub* uses a `FifoChannel` then it will receive all samples. Please note that in the case of having a slow subscriber, back pressure could reach back the publisher. 
```sh
$ ./z_sub
[   0] Pub from Rust!
[   1] Pub from Rust!
[   2] Pub from Rust!
[   3] Pub from Rust!
[   4] Pub from Rust!
[   5] Pub from Rust!
[   6] Pub from Rust!
[   7] Pub from Rust!
[   8] Pub from Rust!
[   9] Pub from Rust!
[  10] Pub from Rust!
```

If you want the subscriber to receive and process the most recent samples, use the `RingChannel`. In this case, the subscriber will take 5 seconds to process a sample, not being able to keep up with the publication rate. Using the `RingChannel` will then allow you to drop old samples and get a more recent one. 
E.g. if you want to always process the most recent sample, you can set the size of the `RingChannel` to 1.
```sh
$ ./z_pull
[   0] Pub from Rust! Sleeping for 5s.
[   2] Pub from Rust! Sleeping for 5s. # Missed sample 1
[   7] Pub from Rust! Sleeping for 5s. # Missed sample 3, 4, 5, 6
[  12] Pub from Rust! Sleeping for 5s. # Missed sample 8, 9, 10, 11
```

---

## C API

Zenoh 1.0.0 underwent a major rework of the C API with the goal of better clarifying data ownership via a well-defined naming semantics of types.

#### Owned types

Owned types are types that are allocated by the user and it is their responsibility to drop them using `z_drop` (or `z_close` for sessions).

Previously, we were returning Zenoh structures by value. 
In Zenoh 1.0.0, a reference to memory must be provided. This allows initializing user allocated structures and frees return value for error codes.

#### Moved types

Moved types are obtained when using `z_move` on an owned type object. They are consumed on use when passed to relevant functions. Any non-constructor function accepting a moved object (i.e. an object passed by owned pointer) becomes responsible for calling drop on it. The object is guaranteed to be in the null state upon such function return, even if it fails.

#### Loaned types

Each owned type now has a corresponding `z_loaned_xxx_t` type, which is obtained by calling `z_loan` or `z_loan_mut` on it, or eventually received from Zenoh functions / callbacks. It is no longer possible to directly access the fields of an owned object, the accessor functions on the loaned objects should instead be used.


#### View types
View types are only wrappers to user allocated data, like `z_view_keyexpr_t.` These types can be loaned in the same way as owned types but they don’t need to be dropped explicitly (user is fully responsible for deallocation of wrapped data).

Here is a quick example of all the above changes:

Zenoh 0.11.0:
```c
int main(int argc, char** argv) {
    z_owned_config_t config = z_config_default();

    z_owned_session_t s = z_open(z_move(config));
    if (!z_check(s)) {
        exit(-1);
    }

    z_put_options_t options = z_put_options_default();
    options.encoding = z_encoding(Z_ENCODING_PREFIX_TEXT_PLAIN, NULL);
    const char *payload = "My payload";
    int res = z_put(z_loan(s), z_keyexpr(args.keyexpr), (const uint8_t*)payload, strlen(payload), &options);
    if (res < 0) {
        printf("Put failed...\n");
    }

    z_close(z_move(s));
    z_drop(z_move(attachment));
    return 0;
}
```

Zenoh 1.0.0:
```c
int main(int argc, char** argv) {
    z_owned_config_t config;
    z_config_default(&config);

    z_owned_session_t s;
    if (z_open(&s, z_move(config)) < 0) {
        exit(-1);
    }

    z_view_keyexpr_t ke;
    z_view_keyexpr_from_str(&ke, args.keyexpr);

    z_owned_bytes_t payload;
    z_bytes_from_static_str(&payload, "My payload");

    z_put_options_t options;
    z_put_options_default(&options);

    int res = z_put(z_loan(s), z_loan(ke), z_move(payload), &options);
    if (res < 0) {
        printf("Put failed...\n");
    }

    z_close(z_move(s));
    return 0;
}
```

For more information on the C API, please see the [migration guide](https://zenoh.io/docs/migration_1.0/c_pico/).

---

## C++ API

Zenoh 1.0.0 brings a number of changes to the API, with a concentrated effort to make the C++ API usage close to the Rust API.

The improvements include:

- A simpler organization of the Zenoh classes, removing the notion of *View* and *Closure*;
- Improved and more flexible Error Handling through error codes and exceptions;
- Improved stream handlers and callback support;
- Simpler attachment API.

#### Error Handling
In Zenoh 0.11.0, all Zenoh call failures were handled by either returning a bool value indicating success or failure (and probably returning an error code) or returning an `std::variant<ReturnType, ErrorMessage>`. For instance:

```cpp
std::variant<z::Config, ErrorMessage> config_client(const z::StrArrayView& peers);
bool put(const z::BytesView& payload, const z::PublisherPutOptions& options, ErrNo& error);
```


In Zenoh 1.0.0, all functions that can fail on the Zenoh side now offer 2 options for error handling:
- Exceptions
- Error Codes

Any function that can fail now accepts an optional parameter ZError* err pointer to the error code. If it is not provided (or set to nullptr), an instance of ZException will be thrown, otherwise the error code will be written into the err pointer.

```cpp
static Config client(const std::vector<std::string>& peers, ZError* err = nullptr);
```

This also applies to constructors: if a failure occurs, either an exception is thrown or the error code is written to the provided pointer. 
In the latter case, the returned object will be in an *empty* state (i.e. converting it to a boolean returns false).

```cpp
Config config = Config::create_default();

// Receiving an error code
Zerror err = Z_OK;
auto session = Session::open(std::move(config), &err);
if (err != Z_OK) { // or alternatively if (!session)
  // handle failure
}

// Catching exception
Zenoh::session s(nullptr); // Empty session object
try {
  s = Session::open(std::move(config), &err);
} catch (const ZException& e) {
  // handle failure
}
```

All returned and `std::move`'d-in objects are guaranteed to be left in an *empty* state in case of function call failure.


#### Stream Handlers and Callbacks
In Zenoh 1.0.0, Subscriber, Queryable and get can now use either a callable object or a stream handler. 
Currently, Zenoh provides 2 types of handlers:
- FifoHandler - serving messages in Fifo order, *blocking* on new messages once full.
- RingHandler - serving messages in Fifo order, dropping older messages once full to make room for new ones.

```cpp
// callback
session.get(
  keyexpr, "", on_reply, on_done,
  {.target = Z_QUERY_TARGET_ALL}
);

// stream handlers interface
auto replies = session.get(
  keyexpr, "", channels::FifoChannel(16), // Or channels::RingChannel(16),
  {.target = QueryTarget::Z_QUERY_TARGET_ALL}
);
// blocking
for (auto res = replies.recv(); std::has_alternative<Reply>(res); res = replies.recv()) {
  const auto& sample = std::get<Reply>(res).get_ok();
  std::cout << "Received ('" << sample.get_keyexpr().as_string_view() << "' : '"
            << sample.get_payload().as_string() << "')\n";
}
```

For more information on the C++ API, please see the [migration guide](https://zenoh.io/docs/migration_1.0/c++/).

---

## Python API

In Zenoh 1.0.0, Python API introduces context managers for the Zenoh session and the various entities like subscriber, queryable and publisher. 
Using the context manager ensures the proper cleanup is called.

For example, to close the Zenoh session after use with context manager:
```python
import Zenoh

with zenoh.open(zenoh.Config()) as session:
    # `session.close()` will be called at the end of the block
```

Session-managed objects like subscribers or queryables can also be managed using context managers:

```python
with session.declare_subscriber("my/keyexpr") as subscriber:
    # `subscriber.undeclare()` will be called at the end of the block`
```

However, these objects can also be used without a context manager, and without calling undeclare. In that case, they will run in “background” mode, meaning that their lifetime will end when the session closes.

```python
import Zenoh
with zenoh.open(zenoh.Config()) as session:
    subscriber = session.declare_subscriber("my/keyepxr")
    for sample in subscriber:
        ...
    # `session.close()` will be called at the end of the block, and it will undeclare the subscriber
```

In Zenoh 0.11.0, it was necessary to keep a variable in the scope for declared *subscribers/queryables/etc*. 
This restriction no longer exists, as objects not bound to a variable will still run in *background* mode, until the session is closed.

Please refer to the [migration guide](https://zenoh.io/docs/migration_1.0/python/) for the complete list of changes on the Python API.

---

## Kotlin API

Finally, after many ‘alpha’ releases, the time has come to provide a first stable release on the Kotlin API, bringing the possibility of using Zenoh on JVM and Android targets! 
The Kotlin API comes with an extensive rework on the API, along with bug fixes, and new implementations.
The changes come with the following goals in mind:
- meeting the new requirements of the Zenoh API rework done across all the Zenoh ecosystem;
- providing an API that fits better with the Kotlin style;
- enhance the API

New features and improvements:
- Scouting: the API now provides scouting support to discover other sessions on the network
- Session context: the session keeps track of the declarations internally, avoiding them to be dropped when losing a reference to them
- KeyExpr rework: key expressions can be safely dropped 
- Config rework and support for string configs with format Json, Json5 and Yaml.
- Replacement of all builder patterns with default arguments.
- Reply rework
- API alignment 

For more information on the Kotlin API, please see the [migration guide](https://zenoh.io/docs/migration_1.0/kotlin/).

---

## Java API

The Java API is still a work in progress, and future extensive rework on the API is to be expected. The beta releases of the Java API are fully compatible with Zenoh 1.0.0. Feel free to use it, but keep in mind that changes are coming to fully align the API with all the other bindings. 
When that will happen, we will provide a corresponding migration guide.

---

## TypeScript API

The TypeScript API is in its alpha stage with the focus being put towards browser support, as majority of the requests from users have been to use Zenoh for UI and visualisation applications, and due to the numerous languages already supported for backend development.
The Typescript API comes with the requirement of using a remote API plugin attached to a Zenoh router running on the backend.
The remote API plugin works by starting a native Zenoh session inside the plugin and communicating over websockets with the browser instance, passing control and data messages between the browser instance and the plugin backend. All state exists inside the plugin and the Typescript API just keeps references to the state stored in the plugin.
It is advised for users to account for the general performance characteristics of a JavaScript runtime environment when designing their applications.

Below is an example of a *subscriber* taking a callback:
```ts
const session = await Session.open(new Config("ws/127.0.0.1:10000"));
  const callback = async function (sample: Sample): Promise<void> {
    console.log!(
      ">> [Subscriber] Received " +
      sample.kind() + " ('" +
      sample.keyexpr() + "': '" +
      sample.payload().deserialize(deserialize_string) + "')",
    );
  };

  let callback_subscriber: Subscriber = await session.declare_subscriber(
    "demo/pub",
    callback,
  );

  await sleep(1000 * 3);
  callback_subscriber.undeclare();
```

Below is an example of a *publisher*:
```ts
  const session = await Session.open(new Config("ws/127.0.0.1:10000"));
  let key_expr = new KeyExpr("demo/example/zenoh-ts-pub");
  let publisher: Publisher = session.declare_publisher(
	key_expr,
    {
      encoding: Encoding.default(),
      congestion_control: CongestionControl.BLOCK,
      priority: Priority.DATA,
      express: true,
      reliability: Reliability.RELIABLE
    }
  );
  const payload = [122, 101, 110, 111, 104];

  for (let idx = 0; idx < Number.MAX_VALUE; idx++) {
	let buf = `[${idx}] ${payload}`;
	console.log("Block statement execution no : " + idx);
	console.log(`Putting Data ('${key_expr}': '${buf}')...`);
	publisher.put(buf, Encoding.TEXT_PLAIN, "attachment");
	await sleep(1000);
  }
```

---

## Shared Memory

Zenoh 1.0.0 adds comprehensive shared memory support with a rich yet unstable API to perform specific SHM actions. 
The SHM subsystem is heavily reworked both on the API and implementation side. 
Shared memory API is currently available in Rust, C and C++ API.

Some key features that have been introduced are:
- Decentralised architecture: this provides process isolation to meet safety requirements.
- No topological constraints: now SHM can be used in any topology (included multi-hop routing networks) as long as data reside in the same shared memory domain;
- SHM routing with seamless SHM to non-SHM conversion: in case data need to leave the SHM domain, Zenoh will automatically convert it to non-SHM;
- Improved robustness: every SHM buffer is now reference-counted and tracked in the whole SHM domain. This allows to automatically reclaim SHM buffers in case of a process crash or unresponsive application. It also allow to safely gain write access to SHM buffers while avoiding concurrent writes, facilitating building SHM-based processing pipelines. 
- Forced SHM buffer deallocation feature; SHM buffer can be explicitly deallocated while in-use.
- User-defined SHM backends: custom allocation strategies using specific shared memory system API can be now be implemented by the user as shown below.

```rust	
// create an SHM backend…
let backend = PosixShmProviderBackend::builder()
    .with_size(65536)
    .unwrap()
    .wait()
    .unwrap();

// ...and an SHM provider
let provider = ShmProviderBuilder::builder()
    .protocol_id::<POSIX_PROTOCOL_ID>()
    .backend(backend)
     .wait();
// There are two API-defined ways of making shm buffer allocations: direct and through the layout...

// Direct allocation
// The direct allocation calculates all layouting checks on each allocation. It is good for
// uniquely-layouted allocations. For making series of similar allocations, please refer to
// layout allocation API which is shown later in this example...
let _direct_allocation = {
    // OPTION: Simple allocation
    let simple = provider.alloc(512).wait().unwrap();

    // OPTION: Allocation with custom alignment and alloc policy customization
    let _comprehensive = provider
        .alloc(512)
        .with_alignment(AllocAlignment::new(2).unwrap())
        .with_policy::<GarbageCollect>()
        .wait()
        .unwrap();

    // OPTION: Allocation with custom alignment and async alloc policy
    let _async = provider
        .alloc(512)
        .with_alignment(AllocAlignment::new(2).unwrap())
        .with_policy::<BlockOn<Defragment<GarbageCollect>>>()
        .await
        .unwrap();

    simple
};

// Create a layout for particular allocation arguments and particular SHM provider
// The layout is validated for argument correctness and also is checked
// against particular SHM provider's layouting capabilities.
// This layout is reusable and can handle series of similar allocations
let buffer_layout = {
    // OPTION: Simple configuration:
    let simple_layout = provider.alloc(512).into_layout().unwrap();

    // OPTION: Comprehensive configuration:
    let _comprehensive_layout = provider
        .alloc(512)
        .with_alignment(AllocAlignment::new(2).unwrap())
        .into_layout()
        .unwrap();

    simple_layout
};

// Allocate ShmBufInner
// Policy is a generics-based API to describe necessary allocation behaviour
// that will be highly optimized at compile-time.
// Policy resolvable can be sync and async.
// The basic policies are:
// -JustAlloc (sync)
// -GarbageCollect (sync)
// -Deallocate (sync)
// --contains own set of dealloc policy generics:
// ---DeallocateYoungest
// ---DeallocateEldest
// ---DeallocateOptimal
// -BlockOn (sync and async)
let mut sbuf = async {
    // Some examples on how to use layout interface:

    // OPTION: The default allocation with default JustAlloc policy
    let default_alloc = buffer_layout.alloc().wait().unwrap();

    // OPTION: The async allocation
    let _async_alloc = buffer_layout
        .alloc()
        .with_policy::<BlockOn>()
        .await
        .unwrap();

    // OPTION: The comprehensive allocation policy that blocks if provider is not able to allocate
    let _comprehensive_alloc = buffer_layout
        .alloc()
        .with_policy::<BlockOn<Defragment<GarbageCollect>>>()
        .wait()
        .unwrap();

    // OPTION: The comprehensive allocation policy that deallocates up to 1000 buffers if provider is not able to allocate
    let _comprehensive_alloc = buffer_layout
        .alloc()
        .with_policy::<Deallocate<1000, Defragment<GarbageCollect>>>()
        .wait()
        .unwrap();

    default_alloc
}
.await;
```

For more information, please see the [migration guide](https://zenoh.io/docs/migration_1.0/rust/#shared-memory).

---

## Plugins

In Zenoh 1.0.0 we finished porting the Zenoh ecosystem from async-std to Tokio. All plugins and storage backends now use Tokio.

As a reminder, Zenoh 0.11.0 added the ability for user-applications to load compiled plugins written in Rust, regardless of which language bindings you are using. See the configuration example on how to load the plugins.

When loading a plugin, it must have been built with the same version of the Rust compiler as the bindings loading it, and the `Cargo.lock` of the plugin must be synced with the same commit of Zenoh.

This means that if the language bindings are using `rustc` version `1.75`:
- The plugin must be built with the same toolchain version `1.75`.
- The plugin must be built with the same Zenoh Commit.
- The plugin `Cargo.lock`  had its packages synced with the Zenoh `Cargo.lock`. 

The reason behind this strict set of requirements is due to Rust making no guarantees regarding data layout in memory. This means between compiler versions, the representation may change based on optimizations. More on this topic here: [Rust:Type-Layout](https://doc.rust-lang.org/reference/type-layout.html#representations)

---

## Interest protocol

Zenoh 1.0.0 introduces a major change in the routing protocol that brings a great scalability improvement and a major discovery traffic consumption reduction.

Up to version 0.11.0, all subscribers, queryables and liveliness tokens declarations were propagated to all nodes of the system. 
In a large system, this could be problematic for small devices. In version 1.0.0, subscribers, queryables and liveliness tokens declarations are not propagated any more to clients and peers subsystems. 
This implies that writer side filtering cannot be performed any more in clients and peers subsystems. 
All publications, queries and liveliness queries are sent to the nearest router. 
Writer side filtering can be reactivated for publications on some key expressions by simply declaring a *publisher*.

---

## Access Control

For Zenoh 1.0.0, we are happy to share that we have added support for TLS and user/password authentication methods as means to identify access control subjects, as relying solely on interface names to identify subjects quickly reaches its limits. 
This addition introduced the need for a way to describe subjects as combinations of multiple attributes of different types (interface, certificate common name, and/or username). 
We have addressed this need by reworking the ACL configuration format, making it modular by isolating the `rules` from the `subjects`. 
This allows the combination of subject attributes, while also avoiding the need to duplicate subject or rule configurations by adding the `policies` list.

On another note, we have shifted the focus of ACL from `actions` to `messages` to make it easier for users to associate the ACL rules to their respective operations exposed via the Zenoh API. 
The `get` action has been replaced by the `Query` message, and we completed the array of supported message types in ACL with the addition of publisher `Delete` and queryable `Reply` messages. Filters for liveliness messages are added later on in Zenoh v1.0.3.

Following this release, a guide on how to configure ACL is available on the [Zenoh reference manual](https://zenoh.io/docs/manual/access-control/), and the [Access Control Rules RFC](https://github.com/eclipse-zenoh/roadmap/blob/main/rfcs/ALL/Access%20Control%20Rules.md) has been updated.

---

## Batching and jitter

The porting of Zenoh to Tokio in 0.11.0 had as a side effect a change in the batching behaviour as reported by some users. 
The issue has been thoroughly investigated resulting in a rework of the batching mechanism in Zenoh 1.0.0. 
This rework accounts for Tokio peculiarities in timing management and improves the overall jitter performance when publishing at high frequency.

---

## Link selection

Link selection refers to the process of choosing a network Link when transmitting messages. 
This is done in the Zenoh Transport layer when two Zenoh nodes are operating in multilink mode (i.e. more than one Link has been established).

In Zenoh 0.11.x, the Link selection implementation picks any Link that matches the Reliability of the transmitted message.
In Zenoh 1.0.0, Links can be tagged with Reliability and Priority range information through Endpoint metadata:

```json
{ listen: { endpoints: ["tcp/localhost:7447?prio=0-3;rel=1"] } }
```

Thus Link selection takes in account both Reliability and Priority of the transmitted message by picking the Link that best matches the given Reliability-Priority pair.

E.g., let's consider the following configuration:

```json
{ listen: { endpoints: ["tcp/localhost:7447?rel=0", "tcp/localhost:7448?rel=1"] } }
```

Will result in listening on two different TCP ports: *7447* that will be used for *best effort* traffic and *7448* that will be used for *reliable traffic*. 

---

## Storage Alignment Protocol

In Zenoh 1.0.0 we have completely rewritten the *storage replication* feature to provide a more robust and configurable implementation.
Users leveraging this functionality will have to update their configuration as this release includes non-backward compatible changes.
The following configuration illustrates the changes:

```json
"plugins": {
    "storage_manager": {
        "storages": {
            "replication-test": {
                "key_expr": "test/replication/*",
                "strip_prefix": "test/replication",
                "volume": "memory",
                // This field was named replica_config.
                "replication": {
                // This field was named publication_interval.
                "interval": 10,
                // This field was named delta.
                "sub_intervals": 5,
                "propagation_delay": 250,
                // These fields did not exist before.
                "hot": 6,
                "warm": 30,
                }
            }
        }
    }
}
```

As shown above, in addition to renaming some fields, we expose two new ones: hot and warm. 
They expose to some extent the algorithm we use in order to keep *storage* aligned and have a direct impact on the quantity of information sent over the network.

As with most things in computer science, tweaking these values comes down to making a trade-off: the higher they are, the more information will be regularly sent but, in turn, the alignment process will be faster, requiring less exchanges. 
Conversely, the lower they are, the less information will be regularly sent but the alignment process could take longer, requiring more message exchanges.
Choosing appropriate values depends on your system: if it is unstable only exceptionally and you do not expect your *storage* to diverge a lot, you can keep these values at their default.

Another important remark, and a difference compared to the previous implementation, is that *storage* will align only if their configurations are identical. This includes: (i) all the fields of the replication section, (ii) the key_expr field of the *storage* and (iii) the strip_prefix field of the *storage*.
The rationale is to avoid comparing information that, in fact, cannot be compared eventually leading to a significant overload: the full alignment algorithm would be triggered at every alignment interval, maybe to no avail if the *storage* are actually aligned.

---

## TLS/mTLS/QUIC Configuration

In Zenoh 1.0.0 we have changed the configuration parameters for TLS/mTLS/QUIC to facilitate the configuration.

The following configuration illustrates the changes:

```json

"transport": {
    "link": {
      "tls": {
        "root_ca_certificate": "/home/user/tls/minica.pem",
        "enable_mtls": true,
        "listen_private_key": "/home/user/tls/localhost/key.pem",
        "listen_certificate": "/home/user/tls/localhost/cert.pem",
        "connect_private_key": "/home/user/client/localhost/key.pem",
        "connect_certificate": "/home/user/client/localhost/cert.pem",
        "verify_name_on_connect":false,
      }
    }
  }
```

For users already using a TLS configuration, it is sufficient to change the configuration parameters according to the following table:

|  Old | New  | 
|---|---|
| client_auth  | enable_mtls   |
| server_name_verification  | verify_name_on_connect   |
|  server_private_key |  listen_private_key |
|  server_certificate |  listen_certificate |
|  client_private_key |  connect_private_key |
|  client_certificate |  connect_certificate |

---

## Zenoh-Pico

Zenoh-Pico implements now the new [C API](#c-api) as well the new [interest protocol](#interest-protocol) when operating in client mode.
Therefore, Zenoh-Pico publishers will now start sending messages on the network only once at least one subscriber is detected, saving energy and bandwidth in case of nodody is interested in the actual data.
The interest feature will be implemented also for peer mode in the future.

---

## Changelog

The effort behind Zenoh 1.0.0 resulted in a large number of bugfixes and improvements.
The full changelog for every Zenoh repository is available at the following links: [Rust](https://github.com/eclipse-zenoh/zenoh/releases), [C](https://github.com/eclipse-zenoh/zenoh-c/releases), [C++](https://github.com/eclipse-zenoh/zenoh-cpp/releases), [Python](https://github.com/eclipse-zenoh/zenoh-python/releases), [Kotlin](https://github.com/eclipse-zenoh/zenoh-kotlin/releases), [Pico](https://github.com/eclipse-zenoh/zenoh-pico/releases), [DDS plugin](https://github.com/eclipse-zenoh/zenoh-plugin-dds/releases), [ROS2 plugin](https://github.com/eclipse-zenoh/zenoh-plugin-ros2/releases), [MQTT plugin](https://github.com/eclipse-zenoh/zenoh-plugin-mqtt/releases), [WebServer plugin](https://github.com/eclipse-zenoh/zenoh-plugin-mqtt/releases), [Filesystem backend](https://github.com/eclipse-zenoh/zenoh-backend-filesystem/releases), [RocksDB backend](https://github.com/eclipse-zenoh/zenoh-backend-rocksdb/releases), [S3 backend](https://github.com/eclipse-zenoh/zenoh-backend-s3/releases), [InfluxDB backend](https://github.com/eclipse-zenoh/zenoh-backend-influxdb/releases).

---

## What’s next?

This has been quite a long blog post but the amount of new features introduced in Zenoh 1.0.0 deserved some space! And now what could you expect from Zenoh in the future? 
- We will keep working on the API to stabilize those functions that today are marked as unstable: they work as expected but some changes may still land. 
- We are planning to extend more API functionalities to all the bindings, e.g. today some API is available only in Rust and we want to make it available as well in Python, C, and C++.
- Liveliness support is planned to be added in Zenoh-Pico.
- We will keep working on performance and scalability of all the zenoh ecosystem.
- And many other cool things…

Happy Hacking,

– The Zenoh Team

P.S. You can reach us out on Zenoh’s [Discord server](https://discord.com/invite/vSDSpqnbkm)!

![Guitar](../../img/20231003-blog-zenoh-dragonite/zenoh-on-fire.gif)
