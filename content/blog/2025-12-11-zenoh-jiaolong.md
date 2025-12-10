---
title: "Zenoh 1.7.x: Jiāolóng"
date: 2025-12-11
menu: "blog"
weight: 20251211
description: "11th December, 2025 -- Paris."
draft: false
---

We are happy to announce the release of Zenoh 1.7.x **Jiāolóng**

Named after the Chinese flood dragon, Jiāolóng represents transformation and the mastery of powerful forces. Like its namesake navigating between realms, this release bridges the gap between simplicity and power, bringing sophisticated capabilities within easy reach of developers across all platforms.

This release focuses on developer productivity and system reliability with powerful new APIs and optimizations across the Zenoh ecosystem. Query cancellation arrives across all language bindings, giving developers fine-grained control over long-running operations. Zenoh-Pico introduces local message optimization with zero-copy loopback paths and automatic task management, making embedded development simpler and more efficient. The shared memory subsystem becomes even more accessible with the transport SHM provider now available through public APIs in Rust, C, and C++.

On the plugin front, the DDS bridge adds full DDS Security support for authenticated and encrypted communication, while the Wireshark dissector has been updated for Wireshark 4.6 compatibility. API refinements across the board — including the improved SourceInfo API and locality configuration — make Zenoh 1.7.x more consistent and easier to use.

Key highlights of this release include:

* **Query Cancellation**: Interrupt ongoing queries with cancellation tokens across Rust, C, C++, Python, and TypeScript — enabling responsive applications and proper resource cleanup.
* **Zenoh-Pico Local Optimization**: Zero-copy loopback path for same-session communication — reducing latency, CPU, and network usage for local flows.
* **Zenoh-Pico Automatic Task Management**: Background tasks now start automatically on `z_open()` in Zenoh-Pico, simplifying application code and improving reconnection handling.
* **Public Transport SHM Provider**: Direct access to Zenoh's internal shared memory provider with full state machine exposure — no need to manage your own provider.
* **DDS Security Support**: Authentication, access control, and cryptographic plugins in zenoh-plugin-dds for secure DDS communication.
* **API Refinements**: Improved SourceInfo API, unified locality configuration, and better consistency across language bindings.
* **Wireshark 4.6 Support**: Zenoh-dissector updated for the latest Wireshark release with enhanced protocol dissection.

Let's break down the enhancements in Jiāolóng!

## Query cancellation

We introduced cancellation tokens that allow interrupting ongoing get queries. 

Cancelling a token unregisters associated get query callback, and if the latter is being currently executed, the cancel operation blocks until execution terminates. Thus, after cancel returns, it is guaranteed that callback will no longer be called. 

Here's a simple example that cancels a query after a 5-second delay:

```rust
let ct = zenoh::cancellation::CancellationToken::default();
let query = session
   .get(key_expression)
   .callback(|reply| {println!("Received {:?}", reply.result());})
   .cancellation_token(ct.clone())
   .await
   .unwrap();

tokio::task::spawn(async move {
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
    ct.cancel().await.unwrap();
});
let reply = query.recv();
```

This functionality is also available in Zenoh-C and Zenoh-Pico:

```c
z_owned_closure_reply_t reply_callback;
z_owned_fifo_handler_reply_t reply_handler;
z_fifo_channel_reply_new(&reply_callback, &reply_handler, 16);

z_get_options_t opts;
z_get_options_default(&opts);
z_owned_cancellation_token_t ct, ct_clone;
z_cancellation_token_new(&ct);
z_cancellation_token_clone(&ct_clone, z_loan(ct));
opts.cancellation_token = z_move(ct_clone);
z_get(z_session_loan(&session), z_loan(&key_expression), "", z_closure_reply_move(&reply_callback), &opts);

z_owned_reply_t reply;
z_result_t res = z_recv(z_loan(&reply_handler), &reply);

/// in another thread ...
z_sleep_s(5);
z_cancellation_token_cancel(z_loan_mut(ct));
```

Zenoh-CPP

```cpp
CancellationToken ct;
Session::GetOptions opt;
opt.cancellation_token = ct;
auto replies = session.get(key_expression, "", channels::FifoChannel(16), std::move(opt));

std::thread t([ct]() {
    std::this_thread::sleep_for(5s);
    ct.cancel();
};
auto reply = replies.recv();
```

Zenoh-Python

```python
cancellation_token = CancellationToken()

replies = session.get(key_expression, cancellation_token=cancellation_token)
def cancel_after_5s(ct: CancellationToken):
    time.sleep(5)
    ct.cancel()

threading.Thread(target=cancel_after_5s, args=(cancellation_token,)).start()
try:
    reply = replies.recv()
except:
    reply = None
```

Zenoh-TS

```typescript
let ct = new CancellationToken();
let replies = await session.get(key_expression, { cancellationToken: ct });
setTimeout(() => ct.cancel(), 5000);
let reply: Reply | undefined;

try {
    reply = await replies!.receive();
} catch (error) {
    reply = undefined;
}
```

## Source info API change

We slightly altered the `SourceInfo` API. Now both source id and sequence number need to be specified to construct a `SourceInfo` struct (since specifying only one does not make much sense in a distributed system). In addition `Sample::source_info` and `Query::source_info` getters return an `Option<SourceInfo>` which contains a `None` value if it was not set by the sender side.

```rust
let publisher = session1.declare_publisher("key/expression").await.unwrap();
let subscriber = session2.declare_subscriber("key/expression").await.unwrap();

publisher.put("data").source_info(SourceInfo::new(id, sn))).unwrap();

/// ...

let sample = subscriber.recv_async().await.unwrap();
if let Some(source_info) = sample.source_info() {
    println!("Received sample sn: {} from {}:{}", source_info.source_sn(), source_info.source_id().zid(), source_info.source_id().eid());
}
```

We also simplified SourceInfo struct in Zenoh-C and Zenoh-Pico making it no longer owned, but a trivial POD type:

```c
z_entity_global_id_t egid = z_session_id(z_loan(session));
uint32_t sn = z_random_u32();
z_source_info_t source_info = z_source_info_new(&egid, sn);

z_put_options_t opts;
z_put_options_default(&opts);
opts.source_info = &source_info;

z_session_put(z_loan(key_expression), z_move(payload), &opts);

/// Upon sample reception ...
z_source_info_t* sample_source_info = z_sample_source_info(z_loan(sample));
if (sample_source_info != NULL) {
    z_entity_global_id_t source_id = z_source_info_id(sample_source_info);
    uint32_t source_sn = z_source_info_sn(sample_source_info); 
    z_id_t zid = z_entity_global_id_zid(&source_id);
    uint32_t eid = z_entity_global_id_eid(&source_id);
    z_owned_string_t id_string;
    z_id_to_string(&id, &id_string);
    printf("Received sample %lu from %.*s : %lu\n", source_sn, (int)z_string_len(z_loan(id_string)), z_string_data(z_loan(id_string), eid);
    z_drop(z_move(id_string));
}
```

## SHM Improvements

**Making SHM Easier: Transport Provider Now Public**

We're excited to announce that Zenoh's internal Shared Memory (SHM) Provider, used within the transport layer, is now available via public API (PR [#2221](https://github.com/eclipse-zenoh/zenoh/pull/2221)).

**What does this mean for you?**

Previously, to use SHM, you had to instantiate and manage your own provider in userland. Now, you can directly utilize the optimized, transport-internal provider, simplifying your code, reducing complexity, and ensuring better integration with Zenoh's core.

**Understanding the Provider's State Machine**

The API exposes the provider's state machine, which is crucial for robust integration. Its lazy-init lifecycle is managed via the `ShmProviderState` enum. Here's a detailed breakdown of each state and the typical transitions:

```rust
pub enum ShmProviderState {
    Disabled,
    Initializing,
    Ready(Arc<ShmProvider<PosixShmProviderBackend>>),
    Error,
}
```

* **`Disabled`**
    * **Meaning:** The SHM provider is turned off. This is the only state if SHM is not configured or has been explicitly disabled for the session or peer.
    * **Triggers:** Configuration (`transport_optimization` not enabled).
    * **Next States:** Not changing.
* **`Initializing`**
    * **Meaning:** The provider is setting up. This is a transient state. Your code should typically wait for it to resolve to either `Ready` or `Error`.
    * **Triggers:** Any first access via Public API or implicit transport needs.
    * **Next States:** Progresses to `Ready` upon successful setup, or to `Error` if initialization fails (e.g., permission issues, resource exhaustion).
* **`Ready(Arc<ShmProvider<PosixShmProviderBackend>>)`**
    * **Meaning:** The provider is fully operational. The contained `Arc<ShmProvider>` is your handle to start creating shared memory buffers for zero-copy data transmission.
    * **This is the primary state for data operations.** You can clone the `Arc` and use the provider freely.
    * **Next States:** Not changing.
* **`Error`**
    * **Meaning:** A non-recoverable error has occurred during initialization (for example, lack of physical memory).
    * **Next States:** Not changing.

**Example:**

```rust
let session = zenoh::open(zenoh::Config::default()).await.unwrap();

// Try to get session's provider for the first time - it is not immediately available
let shm_provider = session.get_shm_provider();
assert!(shm_provider.into_option().is_none());

// Wait for a few time
std::thread::sleep(std::time::Duration::from_millis(100));

// Provider gets available
let shm_provider = session.get_shm_provider();
assert!(shm_provider.into_option().is_some());
```

**Practical Implication for Developers:**

You no longer need to manage this lifecycle yourself. Instead of instantiating your own provider, you can now query or observe the transport's provider state and seamlessly hook into the ready provider when it becomes available. This leads to more reliable and less verbose integration code.

### C Bindings for the Transport SHM Provider

Following the introduction of the public Transport SHM Provider API in Rust (PR [#2221](https://github.com/eclipse-zenoh/zenoh/pull/2221)), we've extended this functionality to the C ecosystem through PR [#1132](https://github.com/eclipse-zenoh/zenoh-c/pull/1132).

#### Key Features of the C Bindings

##### 1. Full State Machine Exposure

The C bindings faithfully expose the complete state machine from the Rust implementation:

```c
typedef enum {
    Z_SHM_PROVIDER_STATE_DISABLED,
    Z_SHM_PROVIDER_STATE_INITIALIZING,
    Z_SHM_PROVIDER_STATE_READY,
    Z_SHM_PROVIDER_STATE_ERROR
} z_shm_provider_state_t;
```

Each state corresponds directly to its Rust counterpart, ensuring consistent behavior across language boundaries.

##### 2. State access API

State access API is also similar to Rust:

```c
z_result_t z_obtain_shm_provider(
	const struct z_loaned_session_t *this_,
	struct z_owned_shared_shm_provider_t *out_provider,
	enum z_shm_provider_state *out_state
);
```

##### 3. Shared SHM Provider design

`z_owned_shared_shm_provider_t` is an owned representation of shared strong reference to underlying z_owned_shm_provider_t. It is designed to support `z_clone()` for  z_owned_shm_provider_t and can be loaned as z_loaned_shm_provider_t:

```c
const z_loaned_shm_provider_t* provider =
	z_shared_shm_provider_loan_as(z_loan(shared_provider));
```

### **Transport SHM Provider in C++**

To reflect C API additions, similar changes were made in C++ bindings, including provider state machine and SharedShmProvider.

#### Semantic changes for State Machine

The provider's state is exposed similarly, but with a few semantic changes.

The "non-available" state is expressed with the enum:

```cpp
/// @brief The non-ready state for SHM provider.
enum class ShmProviderNotReadyState {
    /// Provider is disabled by configuration.
    SHM_PROVIDER_DISABLED,
    /// Provider is concurrently-initializing.
    SHM_PROVIDER_INITIALIZING,
    /// Error initializing provider.
    SHM_PROVIDER_ERROR,
};
```

And the full provider state looks like this:

```cpp
std::variant<SharedShmProvider, ShmProviderNotReadyState>
```

#### API usage example

```cpp
auto session = Session::open(Config::create_default());
auto provider_state = session.get_shm_provider();

if (std::holds_alternative<ShmProviderNotReadyState>(provider_state)) {
    auto state = std::get<ShmProviderNotReadyState>(provider_state);
    // inspect state: SHM_PROVIDER_DISABLED / INITIALIZING / ERROR
} else {
    auto provider = std::get<SharedShmProvider>(provider_state);
    // call provider methods (introspection, tuning, diagnostics, etc.)
}
```

## Zenoh-Pico

### Local messages optimisation

This release features the  co-localised optimisation. PUT/DELETE, query, reply and reply-final messages whose key expressions are declared in the same session are delivered directly without going through the transport layer. This removes serialization, syscalls and network I/O for local flows which helps reduce latency, and CPU usage for in-process or single-device use cases.

Additionally, Zenoh-Pico now exposes a locality selector z_locality_t, to control the locality of  publications, subscriptions, etc.,  where the possible values are:

* `Z_LOCALITY_ANY` (default) — allow both session-local and remote traffic,
* `Z_LOCALITY_SESSION_LOCAL` — stay inside the session (no network activity),
* `Z_LOCALITY_REMOTE` — remote-only traffic (disable same-session delivery).

You can configure locality via `allowed_origin` /` allowed_destination` fields in options such as `z_subscriber_options_t`, `z_publisher_options_t`, `z_put_options_t`, `z_queryable_options_t`, and querier/get options.

**Behaviour change note:** queries can now be handled locally. In previous releases, query/reply flows relied on the transport path and there was no same-session delivery mechanism for queries, so a querier and a queryable declared in the same session would not communicate in a purely local setup. In 1.7.x, the new loopback path allows local queryables to answer local queries without any network activity.

This feature is enabled by `Z_FEATURE_LOCAL_SUBSCRIBER` and `Z_FEATURE_LOCAL_QUERYABLE` build options.

**Benchmark note:** the chart shows query throughput (msgs/s) per payload size. "Remote" is the following setup: two client sessions talking through a router (even running on the same host, AMD Ryzen 7 7840U, 64GB DDR5, Linux). "1.7.x (local)" is the new 1.7.x path: querier and queryable in the same `z_session_t` in the same process, communicating via in-process loopback. This local query scenario was not possible in previous releases, so the improvement reflects a new local path. Importantly the remote curves for 1.6.2 vs 1.7.x show no regressions in the existing remote workflow.

![Query throughput](../../img/20251211-zenoh-jiaolong/pico_local_thr.png)

And the following chart shows latency for the same scenarios:

![Query latency](../../img/20251211-zenoh-jiaolong/pico_local_latency.png)

### Automatic tasks start/stop

In multi-thread builds, Zenoh-Pico can now manage its background tasks automatically. `z_open()` can autostart the read and lease tasks (enabled by default), so most applications no longer need to call `zp_start_read_task()` / `zp_start_lease_task()` manually. This also works nicely with restarting tasks on reconnect: tasks are restarted only if they were configured to run.

This behaviour is controlled via `z_open_options_t`. Users can initialise it with `z_open_options_default()` and pass it to `z_open()`. The defaults keep autostart enabled for read and lease tasks. If your application needs stricter control, you can disable autostart and continue starting/stopping tasks explicitly. There is also a separate switch to autostart the periodic scheduler task (only when periodic tasks are compiled in), so you can keep periodic work fully manual or let Zenoh-Pico manage it.

Example:

```c
z_open_options_t opts;
z_open_options_default(&opts);
// opts.auto_start_read_task = false;		 // Default is true
// opts.auto_start_lease_task = false;	       // Default is true
// opts.auto_start_periodic_task = true;	 // Disabled by default, requires periodic tasks feature enabled
z_open(&session, z_move(config), &opts);
```

### Peer mode improvements

When a Zenoh Pico peer was connected to a router, late-joining subscribers behind that router could miss publications because the writer didn't advertise the correct interest flags to the router. We now include the missing `KEYEXPRS` and `FUTURE` interest flags, so `peer → router → client` flows work reliably.

## Zenoh-C

### Locality API updates

With local subscriber/queryable support being introduced in Zenoh-Pico, `zc_locality` enum was renamed into `z_locality`. The `zc_` prefixed version is still kept for backward compatibility, but marked as deprecated.

## zenoh-plugin-dds

The Zenoh DDS Plugin now supports [DDS Security](https://cyclonedds.io/docs/cyclonedds/latest/security/dds_security.html) on Linux and macOS as an optional feature. The Authentication, AccessControl and Cryptographic service plugins are included as part of the plugin.

## zenoh-dissector

Zenoh-dissector now fully supports the latest Wireshark 4.6, leveraging its latest library for enhanced protocol dissection for the latest Zenoh protocol 1.7.x.


## Changelogs

The full changelog for every Zenoh repository is available at the following links:

[Rust](https://github.com/eclipse-zenoh/zenoh/releases) | [C](https://github.com/eclipse-zenoh/zenoh-c/releases) | [C++](https://github.com/eclipse-zenoh/zenoh-cpp/releases) | [Python](https://github.com/eclipse-zenoh/zenoh-python/releases) | [Java](https://github.com/eclipse-zenoh/zenoh-java/releases) | [Kotlin](https://github.com/eclipse-zenoh/zenoh-kotlin/releases) | [TypeScript](https://github.com/eclipse-zenoh/zenoh-ts/releases) | [Pico](https://github.com/eclipse-zenoh/zenoh-pico/releases) | [DDS plugin](https://github.com/eclipse-zenoh/zenoh-plugin-dds/releases) | [ROS2 plugin](https://github.com/eclipse-zenoh/zenoh-plugin-ros2dds/releases) | [MQTT plugin](https://github.com/eclipse-zenoh/zenoh-plugin-mqtt/releases) | [WebServer plugin](https://github.com/eclipse-zenoh/zenoh-plugin-webserver/releases) | [Filesystem backend](https://github.com/eclipse-zenoh/zenoh-backend-filesystem/releases) | [RocksDB backend](https://github.com/eclipse-zenoh/zenoh-backend-rocksdb/releases) | [S3 backend](https://github.com/eclipse-zenoh/zenoh-backend-s3/releases) | [InfluxDB backend](https://github.com/eclipse-zenoh/zenoh-backend-influxdb/releases)

That's a wrap for Zenoh 1.7.x — **Jiāolóng**! This release delivers practical improvements that make Zenoh easier to use and more powerful — from query cancellation that gives you control over long-running operations, to local message optimization in Zenoh-Pico that eliminates unnecessary network hops, to direct access to the transport SHM provider that simplifies zero-copy workflows.

Whether you're building responsive distributed queries, optimizing embedded applications, securing DDS communication, or leveraging shared memory for high-performance data flows, this release provides the tools and refinements to make your work more productive and your systems more reliable.

We're excited to see what you'll build with these enhancements. As always, your feedback, contributions, and success stories help shape the future of Zenoh. Join the conversation, share your experiences, and help us continue making Zenoh better for everyone.

You can reach us on [Zenoh's Discord server](https://discord.com/invite/vSDSpqnbkm)!

Like the Jiāolóng commanding the flow of data streams, may your systems flow effortlessly and powerfully,

**– The Zenoh Team**

