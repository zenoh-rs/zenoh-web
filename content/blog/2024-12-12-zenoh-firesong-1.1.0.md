---
date: "2024-12-12"
title: 'Zenoh 1.1.0: Firesong Keeps Rocking 🎸'
description: "12th December 2024"
menu: "blog"
weight: 20241212
---

This latest release of Zenoh 1.1.0 brings exciting new features, some of them were already introduced in the 1.0.1, 1.0.2, 1.0.3, and 1.0.4 releases. The key features are:

### API

* Stabilization of liveliness API support. Liveliness has been part of Zenoh for quite some time but the API was still marked as unstable. We have now stabilized it. 
* New unstable querier API for automatic queries optimization.
* A new unstable advanced publisher/subscriber on zenoh-ext supporting non-blocking fault tolerance end-to-end.

### Zenoh-Pico

* New unstable manual batching for zenoh-pico for improved throughput.
* Added liveliness support to align with the other Zenoh APIs.
* Performance improvement due to some internal code refactoring.
* Added support for Raspberry Pi Pico board.

### ROS 2 Bridge

* Better support of ROS 2 Iron and Jazzy.
* A ROS 2 Service Client can more easily call a Zenoh Queryable via the bridge.

### Protocol Updates

* Backward-compatible fix of protocol fragmentation in case of messages drop. The issue was resulting in some large messages being malformed after defragmentation. This is now fixed.
* Fix serial link to support connection re-establishment. Serial connections struggled to be reestablished upon link failure. This has been improved.

### Commercial Support and Tools
* ZettaScale provides commercial support as well as extended lifetime support  for v1.x. 
* ZettaScale now provides a commercial of Zenoh for QNX.
* Zetta Control Center (ZettaC2) is now available to visualise, monitor and manage your running Zenoh System from the cloud to the microcontroller.


## Querier

The querier has been added to Zenoh to serve a similar purpose of the publisher but for queries. For example, a publisher allows Zenoh to perform some optimization for continuous publications like [write-side filtering](https://www.google.com/url?q=https://zenoh.io/blog/2024-10-21-zenoh-firesong/%23interest-protocol&sa=D&source=docs&ust=1733925165202597&usg=AOvVaw1piF0-TzhbWXLP5chS1fKO) and [matching status](https://docs.rs/zenoh/latest/zenoh/pubsub/struct.Publisher.html#method.matching_status). These kinds of optimizations are now also available for queries through the new querier API. A Rust example is provided below and [here](https://github.com/eclipse-zenoh/zenoh/blob/main/examples/examples/z_querier.rs). The same example is also available in [C](https://github.com/eclipse-zenoh/zenoh-c/blob/main/examples/z_querier.c), [C++](https://github.com/eclipse-zenoh/zenoh-cpp/blob/main/examples/zenohc/z_querier.cxx), and [Python](https://github.com/eclipse-zenoh/zenoh-python/blob/main/examples/z_querier.py).


```rust
#[tokio::main]
async fn main() {
    let session = zenoh::open(Config::default()).await.unwrap();

    let querier = session
        .declare_querier(selector.key_expr())
        .target(target)
        .timeout(timeout)
        .await
        .unwrap();
    querier
        .matching_listener()
        .callback(|matching_status| {
            if matching_status.matching() {
                println!("Querier has matching query tables.");
             } else {
                println!("Querier has NO MORE matching queryables.");
             }
        })
        .background()
        .await
        .unwrap();

    for idx in 0..u32::MAX {
        tokio::time::sleep(Duration::from_secs(1)).await;
        let replies = querier
            .get()
            .await
            .unwrap();
        while let Ok(reply) = replies.recv_async().await {
            let _ = reply.result().unwrap()
        }
    }
}
```

## Zenoh-Pico

### Manual Batching

Rust-based implementation APIs (i.e. C, C++, Python, Kotlin, Java) offer automatic message batching. In other words, Zenoh automatically batches messages based on the network backpressure to both increase throughput and reduce latency.

This wonderful automatic magic comes with some complexity that was considered too high for fitting in microcontrollers targeted by Zenoh-Pico (memory is quite expensive…). But does it mean we cannot have batching in Zenoh-Pico? Not at all! In this release we have introduced a simple API that allows users to explicitly control message batching. Please note that manual batching will make Zenoh-Pico to batch messages until the sending batch is full (the maximum batch size is 64KB and it can be configured to a smaller value). When the batch is full, Zenoh-Pico will automatically send the batch on the network.

```c
int main(int argc, char **argv) {
    z_view_keyexpr_t ke;
    z_view_keyexpr_from_str(&ke, "example/batching");
    uint8_t value = 0x55;
    z_owned_bytes_t payload;
    z_bytes_from_buf(&payload, &value, 1, NULL, NULL);
    z_owned_config_t config;
    z_config_default(&config);
    
    z_owned_session_t s;
    z_open(&s, z_move(config), NULL);
    zp_start_lease_task(z_loan_mut(s), NULL);
    zp_start_read_task(z_loan_mut(s), NULL);

    zp_batch_start(z_loan(s)); // Start batching
    for (int i = 0; i < 1000000; i++) {
        z_owned_bytes_t p;
        z_bytes_clone(&p, z_loan(payload));
        z_put(z_loan(s), z_loan(ke), z_move(p), NULL);
    }
    zp_batch_stop(z_loan(s)); // Stop batching

    z_drop(z_move(s));
    z_drop(z_move(payload));
    return 0;
}
```

### Raspberry Pi Pico

We are excited to announce support for the Raspberry Pi Pico series in Zenoh-Pico! This addition makes it possible to leverage Zenoh-Pico’s lightweight and efficient communication capabilities on `RP2040/RP2350`-based devices.
To get started, check out the new Raspberry Pi Pico section in the [README](https://github.com/eclipse-zenoh/zenoh-pico?tab=readme-ov-file#226-raspberry-pi-pico). This includes detailed instructions for building and running Zenoh-Pico on Pico devices, enabling seamless integration into your IoT projects.

### Performance

A lot of effort has been devoted to improving throughput and latency performance in Zenoh-Pico. A big improvement has been brought by:

* The rework of the internal fragmentation engine for large messages.
* The addition of manual batching for small (non-fragmented) messages.

Notably, the latency has been reduced to up to 1/50th (i.e. 5000% better) for large fragmented messages and up to 35% for non-fragmented messages. Moreover, the throughput has increased up to 60% for non-fragmented messages and up to 10x (i.e. 1000% better) for large fragmented messages in peer-to-peer over UDP multicast (§). In client mode, the throughput has been increased up to 10x (i.e. 1000% better) for large messages.
Enabling manual batching can increase throughput of non-fragmented packets, with up to 20x (i.e. 2000% better) msg/s for 8 byte payloads.

(§) Zenoh-Pico only supports UDP multicast in peer mode.

## ROS 2 Bridge

ROS 2 Iron and Jazzy introduced some changes that the `zenoh-plugin-ros2dds` and `zenoh-bridge-ros2dds` now support.

* The **Type Description Distribution**, a.k.a. [REP-2016](https://github.com/ros-infrastructure/rep/pull/381) or type hash: The bridge re-transmit the type hashes exposed by the ROS Nodes to the remote bridges, so they re-expose them in the same way to remote ROS Nodes.

* `ROS_AUTOMATIC_DISCOVERY_RANGE` and `ROS_STATIC_PEERS`: The bridge supports those new environment variables starting from Iron, and still supports the `ROS_LOCALHOST_ONLY` environment variables with ROS distributions prior to Iron.

The `zenoh-bridge-ros2dds` now also leverages the new Querier and its matching status. This means that implementing a Zenoh Queryable which is able to act as a ROS Service Server no longer requires the declaration of a Liveliness Token to be discovered by the bridge.

## Advanced Pub/Sub

This version introduces:
* An **AdvancedPublisher** that can:
  * Cache last published samples to be retrieved by AdvancedSubscribers for history or recovery.
  * Sequence samples to allow AdvancedSubscribers to detect missed samples.
  * Automatically create a Liveliness token to assert its presence.
* An **AdvancedSubscriber** that can:
  * Retrieve historical data from AdvancedPublishers.
  * Detect missed samples.
  * Recover missed samples from AdvancedPublishers.
  * Monitor matching AdvancedPublishers through liveliness to query history of late joiners.

Examples:

```rust
// Advanced Publisher
use zenoh_ext::{AdvancedPublisherBuilderExt, CacheConfig};

let session = zenoh::open(zenoh::Config::default()).await.unwrap();
let publisher = session
    .declare_publisher("key/expression")
    .cache(CacheConfig::default().max_samples(10))
    .sample_miss_detection()
    .publisher_detection()
    .await
    .unwrap();

publisher.put("Value").await.unwrap();
```

```rust
// Advanced Subscriber
use zenoh_ext::{AdvancedSubscriberBuilderExt, HistoryConfig, RecoveryConfig};

let session = zenoh::open(zenoh::Config::default()).await.unwrap();
let subscriber = session
    .declare_subscriber("key/expression")
    .history(HistoryConfig::default().detect_late_publishers())
    .recovery(RecoveryConfig::default())
    .await
    .unwrap();

let miss_listener = subscriber.sample_miss_listener().await.unwrap();
loop {
    tokio::select! {
        sample = subscriber.recv_async() => {
            if let Ok(sample) = sample {
                // ...
            }
        },
        miss = miss_listener.recv_async() => {
            if let Ok(miss) = miss {
                // ...
            }
        },
    }
}
```

Connectivity Status and Events have been updated to be retrievable through an AdvancedSubscriber (see [Connectivity Status and Events](https://github.com/eclipse-zenoh/roadmap/blob/main/rfcs/ALL/Connectivity%20Status%20and%20Events.md#using-the-advancedsubscriber)).
The FetchingSubscriber and PublicationCache have been marked as deprecated.

## Miscellaneous

* **TCP buffers**: TCP and TLS links got more tuning options with the introduction of TCP buffers configuration. Users can now configure read/write TCP buffer sizes with custom values, independently for each endpoint via endpoint configuration (ex: `tcp/[::]:7447#so_sndbuf=65000;so_rcvbuf=65000`) or per protocol basis via the Zenoh config file, respectively in the `transport/link/tcp` and `transport/link/tls` sections.

* **QUIC/TLS Interface Binding**: Interface binding for Zenoh links has been available on Linux for TCP and UDP for some time now. In this release, we have extended the support of interface binding to TLS and QUIC links, via the same endpoint configuration format (ex: `tls/[::]:7447#iface=wlan0`).

* **Publisher QoS Overwrites**: A new performance-tuning feature introduced in this release is the capability of overwriting QoS configuration of publishers, namely: priority, reliability, congestion control, and express. All the configuration happens via the newly added `qos/publications` section of the Zenoh config file.
A publisher configuration can be passed per key-expression, which will overwrite any publisher or `put` operation with a key-expression that it includes (see more about key-expression inclusion in the [Key Expressions RFC](https://github.com/eclipse-zenoh/roadmap/blob/73b2d4bad44bf35638f97d449907da6f79ec6f9b/rfcs/ALL/Key%20Expressions.md#the-basics)).
As the name implies, QoS overwrites take priority over the publishers and `put` builders API, which makes them quite handy when using a library that uses Zenoh but does not expose the publisher QoS API, or when debugging or tuning a black-box Zenoh application.

## Changelogs
The effort behind Zenoh 1.1.0 resulted in a large number of bug fixes and improvements. The full changelog for every Zenoh repository is available at the following links: [Rust](https://github.com/eclipse-zenoh/zenoh/releases) | [C](https://github.com/eclipse-zenoh/zenoh-c/releases) | [C++](https://github.com/eclipse-zenoh/zenoh-cpp/releases) | [Python](https://github.com/eclipse-zenoh/zenoh-python/releases) | [Kotlin](https://github.com/eclipse-zenoh/zenoh-kotlin/releases) | [Pico](https://github.com/eclipse-zenoh/zenoh-pico/releases) | [DDS plugin](https://github.com/eclipse-zenoh/zenoh-plugin-dds/releases) | [ROS2 plugin](https://github.com/eclipse-zenoh/zenoh-plugin-ros2dds/releases) | [MQTT plugin](https://github.com/eclipse-zenoh/zenoh-plugin-mqtt/releases) | [WebServer plugin](https://github.com/eclipse-zenoh/zenoh-plugin-webserver/releases/tag/1.0.4) | [Filesystem backend](https://github.com/eclipse-zenoh/zenoh-backend-filesystem/releases) | [RocksDB backend](https://github.com/eclipse-zenoh/zenoh-backend-rocksdb/releases) | [S3 backend](https://github.com/eclipse-zenoh/zenoh-backend-s3/releases) | [InfluxDB backend](https://github.com/eclipse-zenoh/zenoh-backend-influxdb/releases)

## What's next?

* We will keep working on the APIs to stabilize functions currently marked as unstable: they work as expected but some changes may still land.
* We are planning to extend more API functionalities to all the bindings, e.g. today some APIs are available only in Rust and we want to make them available as well in Python, C, and C++.
* We will keep working on performance and scalability of all the Zenoh ecosystem.
* And many other cool things ...

Whether you are working with Rust, C, C++, Python, or other supported languages, this update addresses the feedback we received from the community and empowers Zenoh developers with new tools. Make sure to explore all these updates by trying out Zenoh Firesong 1.1.0. Thanks to all contributors and users!

Happy Hacking,
– The Zenoh Team

P.S. You can reach us out on [Zenoh’s Discord server](https://discord.com/invite/vSDSpqnbkm)!