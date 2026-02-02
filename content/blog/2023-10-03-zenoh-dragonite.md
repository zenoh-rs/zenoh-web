---
title: "Zenoh Dragonite Took Off!"
date: 2023-10-03
menu: "blog"
weight: 20231003
description: "October 3rd, 2023 -- Paris"
draft: false
---

We are happy to announce the release of Zenoh 0.10.0-rc **Dragonite**.

This version introduces new important features and improvements we have been working on the last couple of months. Specifically, this release introduces:

- [Improved protocol: _The Best Pub/Sub/Query Protocol Gets Better_](#the-best-pubsubquery-protocol-gets-better)
- [New WireShark Plugin](#new-zenoh-wireshark-plugin)
- [New Kotlin API](#zenoh-kotlin-api)
- [Support for Ultra Low Latency](#support-for-ultra-low-latency)
- [ROS1 Bridge](#ros1-bridge)
- [C++ API Changes & Documentation release](#c-documentation--api-changes)

# The Best Pub/Sub/Query Protocol Gets Better!

{{< figure-inline
    src="../../img/20231003-blog-zenoh-dragonite/comic_august_2023.jpg"
    class="figure-inline"
    alt="Zenoh Comic"
    width="40%" >}}

With this release, Zenoh gets a series of protocol improvements and extensions, such as improved support for multicast and constrained devices. Additionally, some new mechanisms have been introduced to make it easier to add protocol extensions in the future without compromising backward compatibility.

These were the first batch of changes that will break wire-compatibility. We plan to have the second and final batch on the next release and then seal the protocol with a shiny 1.0 stamp !

# New Zenoh WireShark Plugin

{{< figure-inline
    src="../../img/20231003-blog-zenoh-dragonite/zenoh-dissector.png"
    class="figure-inline"
    alt="Zenoh Dissector"
    width="60%" >}}

Those of you that, like us, love dissecting protocols, will be pleased to learn that we have a new WireShark plugin for Zenoh – this new dissector is written in Rust!

The new [zenoh-dissector](https://github.com/ZettaScaleLabs/zenoh-dissector) makes it easier to spoof Zenoh packets and display them as human-readable messages. We also decided to change the implementation of the Wireshark plugin from Lua to Rust to reuse the codec defined in the Zenoh source code. Now, the parsing of Zenoh messages will be smoothly synchronized with any newer version of the Zenoh protocol! Moreover, the change gives us better performance and brings the potential to visualize more information in cooperation with Zenoh Rust library. Please give it a try, and any feedback is welcome!

# Zenoh Kotlin API

{{< figure-inline
    src="../../img/20231003-blog-zenoh-dragonite/zenoh-kotlin.png"
    class="figure-inline"
    alt="Zenoh Kotlin"
    width="30%" >}}

This release introduces Zenoh to the world of Kotlin, and vice-versa ;-). The [Zenoh Kotlin API](https://github.com/eclipse-zenoh/zenoh-kotlin) targets the JVM environment and essentially opens the use of Zenoh to all the JVM-based programming languages.
In this alpha version, you’ll find most of Zenoh’s features. You'll be able to publish, subscribe and query data.
Next we will be working on platform independent packaging and Android support.

Below is the [ZSub.kt example](https://github.com/eclipse-zenoh/zenoh-kotlin/blob/main/examples/src/main/kotlin/io.zenoh/ZSub.kt) that will be useful to briefly take a look at the Zenoh’s Kotlin API.
Here, we illustrate how to open a session, create a key expression, declare a subscriber (specifying some configuration parameters) and handle incoming samples – using the default channel handler with a coroutine.

```kotlin
println("Opening session...")
Session.open().onSuccess { session -> session.use {
     "demo/example/**".intoKeyExpr().onSuccess { keyExpr ->
            println("Declaring Subscriber on '$keyExpr'...")
            session.declareSubscriber(keyExpr)
                .bestEffort()
                .res()
                .onSuccess { subscriber ->
                    subscriber.use {
                        runBlocking {
                            val receiver = subscriber.receiver!!
                            val iterator = receiver.iterator()
                            while (iterator.hasNext()) {
                                val sample = iterator.next()
                                println(">> [Subscriber] Received ${sample.kind} ('${sample.keyExpr}': '${sample.value}')")
                            }
                        }
                    }
               }
            }
        }
}
```

For more information, checkout the [Kotlin API documentation](https://eclipse-zenoh.github.io/zenoh-kotlin/index.html).

# Support for Ultra Low-Latency

Although Zenoh is already capable of delivering very low latency – as low as 10 us (see [here](/blog/2023-03-21-zenoh-vs-mqtt-kafka-dds/#latency-comparison)). We believe that we can do even better! This release introduces the experimental support for **ultra low latency** communication to address those applications that care about every single microsecond. For example, applications communicating over shared-memory will greatly benefit from it… and it will also be required for a new Zenoh's high-performance SHM API we are cooking up.

The two experimental features we are introducing in Zenoh 0.10.0-rc to get to ultra low latency communication are:

- **Unix Pipe Link**. This is an alternative way for intra-host communication on Unix systems. For instance, when two Zenoh peers are running on the same host they can use pipes to communicate instead of TCP, TLS, UDP, etc. Currently, it has only been tested on Linux only.
- **Low Latency Profile**. This feature tunes Zenoh’s batching, scheduling, and queueing to achieve ultra low latency. It is worth highlighting that this experimental feature presents some limitations as of today: QoS is not supported and message sizes are limited to 64KB. It’s our plan to lift these limitations in future releases of Zenoh.

In order to test it out, you need to compile Zenoh with `transport_unixpipe` feature and enable the `lowlatency profile`. For example, you can create a Zenoh configuration file (called `lowlatency.json5`) with the content below:

```
// lowlatency.json5 Zenoh config file
{
  transport: {
    unicast: {
      lowlatency: true, // enable low latency unicast transport
    },
    qos: {
      enabled: false, // disable qos
    },
  },
}
```

You can then build and run our latency examples (`z_ping `and` z_pong`) as follows:

```
# build examples with 'transport_unixpipe' feature
cargo build --release -F transport_unixpipe --examples
cd  target/release/examples
…
# run z_pong example
./z_pong --no-multicast-scouting -c lowlatency.json5 -l unixpipe/example_endpoint.pipe
…
# run z_ping example
./z_ping 64 --no-multicast-scouting -c lowlatency.json5 -e unixpipe/example_endpoint.pipe
```

On our testing machine (AMD Ryzen 7 5800X with 32 GB of RAM), the newly introduced experimental features for ultra low latency support reduce latency of ~30% as shown in the table below.

{{< table "table table-striped table-bordered w-auto" >}}
| Protocol | 5th Percentile | Median | 95th Percentile |
| :------------------ | -------------: | -----: | --------------: |
| P2P, Y LowLat, Pipe | 6.0 | 7.0 | 9.0 |
| P2P, N LowLat, TCP | 10.0 | 10.0 | 11.0 |
{{< /table >}}

Clearly, this is a first step for Zenoh and more is to be expected in the future!

#

# ROS1 bridge

We are happy to announce that the ROS1 bridge, introduced in [Zenoh Charmander](/blog/2023-06-05-charmander2/#ros1-bridge), has been released! To better understand how the ROS1 bridge works, let’s recall that any ROS1 system is centralized and contains one ROS1 Master service and a set of services called ROS1 Nodes. Each Node is capable of publishing, subscribing or querying some topics. ROS Master aggregates information about Nodes and their topics and provides a nameservice for Nodes to help them discover each other and establish direct connections when necessary. Those direct connections are used by Nodes to transport the actual topic data.

{{< figure-inline
    src="../../img/20231003-blog-zenoh-dragonite/zenoh-ros1.png"
    class="figure-inline"
    alt="Zenoh & Ros1"
    width="60%" >}}

Compared to the alpha version, we significantly improved algorithms that utilize ROS1 standard ROSXMLRPC APIs of ROS1 Master and Nodes to collect information on the local ROS1 system. This gives the bridge the capability to also preserve topic data types and md5 signatures. Now ROS1 Bridge carefully probes all entities of the local ROS1 system to keep the information up-to-date, trying to apply caching when possible to reduce the costs of its operation.

Another significant change is the new fine-grained bridging mode config. Now users can specify bridging policy (Auto\Lazy\Disabled) both globally and for specific ROS1 topics.

As a result, the bridge is capable to expose ROS1 topics for publishers, subscribers, services and clients into Zenoh network as a set of Zenoh publishers, subscribers, queryables and queries, providing ROS1 system all set of Zenoh features, like highly-efficient and flexible network operation, storage-based data caching, etc. Moreover, multiple ROS1 systems bridged into one Zenoh network are capable of seeing each other and interact seamlessly.

ROS1 to Zenoh Bridge aims to be completely transparent, making interaction with remote ROS1 topics as if they were local. The integration to any existing ROS1 system does not require its tuning, recompilation etc (of course, if its application logic won't get mad of seeing remote ROS1 topics in its environment :) ).

To test a new bridge, please try the following:

```bash
# To run this example, you should have ROS1 locally installed….
# build the bridge from source
cargo build
cd target/debug/
# terminal 1:
rosmaster -p 10000
# terminal 2:
rosmaster -p 10001
# terminal 3:
./zenoh-bridge-ros1  --ros_master_uri http://localhost:10000
# terminal 4:
./zenoh-bridge-ros1  --ros_master_uri http://localhost:10001
# terminal 5:
ROS_MASTER_URI=http://localhost:10000 rostopic pub /topic std_msgs/String -r 1 test_message
# terminal 6:
ROS_MASTER_URI=http://localhost:10001 rostopic echo /topic
```

As the result, you will see the topic `/topic` bridged from one ROS1 system to another:

{{< figure-inline
    src="../../img/20231003-blog-zenoh-dragonite/ros-topics.png"
    class="figure-inline"
    alt="Ros1 Topics"
    width="60%" >}}

# C++ Documentation & API changes

An important step has been taken for the Zenoh C++ library with the publishing of the documentation, now available at [https://zenoh-cpp.readthedocs.io](https://zenoh-cpp.readthedocs.io/).

Several API changes have been made in the C++ API. The most significant change is related to closures. They now accept parameters by reference instead of pointers:

```cpp
session.declare_subscriber("foo/bar", [](const Sample& sample) {
   // No need to check for nullptr anymore; the code is safe
   std::cout << sample.get_payload().as_string_view() << std::endl;
});
```

The use of `nullptr` had a special meaning before; it signaled that the data stream is closed. This can now be handled with an optional drop handler:

```cpp
auto on_reply = [](Reply &&reply) {
    // Process the data
};

auto on_done = []() {
    // Finish data processing
};
GetOptions opts;
opts.set_target(Z_QUERY_TARGET_ALL);
session.get("foo/bar", "", {on_reply, on_done}, opts);
```

Another change is related to the handling of key expressions, which differs between Zenoh-C and Zenoh-Pico. In the case of Zenoh-Pico, the `KeyExpr` object is unaware of its string representation if it is declared with `Session::declare_keyexpr`. So a perfectly valid `KeyExpr` object returns incorrect results from its `equals`, `includes`, and `intersects` operations. To avoid such unexpected errors, these operations without explicit error handling have been disabled for Zenoh-Pico. Instead, `Session::keyexp_equals`, `Session::keyexpr_intersects`, and `Session::keyexpr_includes` have been added. For more details, checkout the [KeyExpr documentation](https://zenoh-cpp.readthedocs.io/en/latest/keyexpr.html).

Large cleanup of warnings was performed: now Zenoh C++ can be compiled with the strictest warning level (see the related [issue](https://github.com/eclipse-zenoh/zenoh-cpp/issues/71)).

# What’s next?

Developing Zenoh is an amazing part of our journey on this beautifully blue planet. This release represents another step forward in our goal to provide the community with a blazingly fast, decentralized and scalable Pub/Sub/Query protocol, with an ecosystem allowing us to have Zenoh running on a multitude of environments that span from robotics to autonomous driving vehicles and more!

Many more things are yet to come!

- Targeting Android with the Zenoh-Kotlin API, as well as Java compatibility
- We’ll keep enhancing the ROS1 Bridge as well as the Shared Memory feature
- Improving the protocol to further reduce the declaration traffic to/from clients
- A new JavaScript API for running Zenoh in your browser
- And more…!

You can take part in this process by joining our community on [Discord](https://discord.com/invite/vSDSpqnbkm). There you will be able to chat with us as well as with other members of the community, discuss features on the roadmap, and more.

![Guitar](../../img/20231003-blog-zenoh-dragonite/zenoh-on-fire.gif)

—

The Zenoh Team
