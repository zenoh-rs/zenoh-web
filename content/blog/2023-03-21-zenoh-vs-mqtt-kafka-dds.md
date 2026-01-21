---
title: "Comparing the Performance of Zenoh, MQTT, Kafka, and DDS"
date: 2023-03-21
menu: "blog"
weight: 20230321
description: "21 March 2023 -- Taipei."
draft: false
---
### Prologue
This instalment features a blog contributed by a team of researchers from the prestigious
[National Taiwan University (NTU)](https://www.ntu.edu.tw/english/). This team has been using
Zenoh for some time in R2X and V2X R&D projects and recently did an interesting performance comparison
between our blue dragon protocol, MQTT, Kafka and DDS. I'd like to thank the NTU team on behalf of the
Zenoh community as this evaluation answers a couple of questions we are asked quite often.

-- [kydos](https://github.com/kydos)


## Introduction
High performance has always been one of the main goals of Zenoh. While  Zenoh\'s performance is provided for each release (see
[here](https://zenoh.io/blog/2022-09-30-zenoh-bahamut/#improved-performance),
[here](https://zenoh.io/blog/2022-04-14-rust-async-eval/), and
[here](https://zenoh.io/blog/2021-07-13-zenoh-performance-async/)), so far there were no performance evaluations that
compared Zenoh with other technologies. Yet, this was a question commonly asked on Zenoh's discord server and on github.
In this blog, we'll present an evaluation conducted by the [National Taiwan
University](https://www.ntu.edu.tw/english/) where Zenoh\'s
performance is compared with MQTT, Kafka, and DDS. A comprehensive version of this
blog is available on [arXiv](https://arxiv.org/abs/2303.09419) to provide a detailed description and analysis
for further study [^median_vs_mean].

[^median_vs_mean]: Instead of displaying averaged numbers (with standard deviations)
    in the [arXiv](https://arxiv.org/abs/2303.09419) version,
    median values are used in this blog to increase the fairness of the comparison.

## Communication models

MQTT and Kafka adopt a brokered communication model where every message must go
through a broker. Differently, DDS adopts a peer-to-peer communication model
where messages are directly exchanged between publishers and subscribers
without any middleman. Zenoh supports both the brokered and the peer-to-peer
communication models, as well as a routed infrastructure mode.
Fig. 1 illustrates the models with mixed topology, in which
Mesh and Clique are peer-to-peer models. See the various [deployment
models](https://zenoh.io/docs/getting-started/deployment/) for more insights.
For a fair comparison with MQTT, Kafka, and DDS, both brokered and peer-to-peer
modes are used in Zenoh.

{{< figure-inline
    src="../../img/20230321-performance-comparison/topology.png"
    caption="Fig. 1 Topology offered by Zenoh"
    class="figure-inline"
    alt="Topology offered by Zenoh"
    width="60%" >}}


## Tested Performance Indicators

For this performance evaluation, we were interested in evaluating two key
performance indicators, namely throughput and latency. Fig. 2 shows the
communication diagram for the throughput measurements. For the
comparison between Zenoh, MQTT, and Kafka, all the data flows through
the "Broker" or the "Zenoh Router" to the subscriber. For the Zenoh peer
mode and DDS tests, the data pass directly from the publisher to the
subscriber.

{{< figure-inline
    src="../../img/20230321-performance-comparison/throughput-configuration.png"
    caption="Fig. 2 The configuration diagram for throughput tests"
    class="figure-inline"
    alt="The configuration diagram for throughput tests"
    width="70%" >}}


Fig. 3 shows the communication diagram for the latency measurement.
Similar to the throughput test, the message will be forwarded by the
broker or the router for MQTT, Kafka, and the Zenoh client mode, and for
the Zenoh peer mode and DDS, the data will be passed between the ping
and pong nodes directly.

{{< figure-inline
    src="../../img/20230321-performance-comparison/latency-configuration.png"
    caption="Fig. 2 The configuration diagram for latency tests"
    class="figure-inline"
    alt="The configuration diagram for latency tests"
    width="70%" >}}

## Testbed configuration

Two scenarios were prepared for the experiments: on a single machine and
on multiple machines connected through Ethernet. For the
multiple-machine scenario, the tested programs and the broker (or the
Zenoh Router) will be run on different machines. Tab. 1 shows the
configuration for each of the used machines.

Tab. 1 The configuration of the testing machines

{{< table "table table-striped table-bordered w-auto" >}}
| Type    | Specification                                                                          |
|---------|----------------------------------------------------------------------------------------|
| OS      | Ubuntu 20.04.3 LTS                                                                     |
| CPU     | AMD Ryzen 7 5800X running at a fixed frequency of 4.0 GHz 8-Core Processor, 16 threads |
| RAM     | 32 GiB DDR4 3200MHz                                                                    |
| Network | 100Gb Ethernet (for the multiple-machine scenario)                                     |
{{< /table >}}

The testing procedures are the same for all of Zenoh, DDS, MQTT, and
Kafka. Their versions and settings are described below. The procedures
were designed according to the suggestions from [the guide for accurate
measurement](https://easyperf.net/blog/2019/08/02/Perf-measurement-environment-on-Linux).
All the benchmark programs can be found under the [Zenoh performance
test project](https://github.com/ZettaScaleLabs/zenoh-perf/tree/master/comparison).

For Zenoh, the
[test programs](https://github.com/ZettaScaleLabs/zenoh-perf/tree/master/comparison/zenoh)
use [version 0.7.0-rc](https://github.com/eclipse-zenoh/zenoh/tree/0.7.0-rc)
and the Zenoh router `zenohd` can be built by following this
[guide](https://github.com/eclipse-zenoh/zenoh#how-to-install-it). Its
reliability was set to "reliable" and the congestion control option was set to
"Block" on the publisher side. For the latency measurements, its reliability
was set to "BestEffort" to align with the behavior of Kafka and MQTT.

For MQTT, the
[test programs](https://github.com/ZettaScaleLabs/zenoh-perf/tree/master/comparison/mqtt)
use [Eclipse Mosquitto version 2.0.15](https://github.com/eclipse/mosquitto/archive/refs/tags/v2.0.15.tar.gz).
The MQTT clients were implemented with the [Eclipse Paho MQTT C client
library
v.1.3.11](https://github.com/eclipse/paho.mqtt.c/releases/tag/v1.3.11).
For all MQTT clients, the communication QoS level was set to 0 to
achieve its best performance.

For Kafka, the
[test programs](https://github.com/ZettaScaleLabs/zenoh-perf/tree/master/comparison/kafka)
use the [official broker
3.2.1](https://archive.apache.org/dist/kafka/3.2.1/kafka_2.13-3.2.1.tgz) and the

[rdkafka client library
0.28.0](https://github.com/fede1024/rust-rdkafka/tree/v0.28.0). The following
parameters were chosen according to the suggestions from the [online
documents](https://docs.confluent.io/cloud/current/client-apps/optimizing/index.html)
and real experiments in order to get better results: linger.ms=0 and
batch.size=400KB for throughput, 1 for latency; compression.type=none, acks=0
and fetch.min.bytes=1 (only for latency tests).

For DDS, the
[test programs](https://github.com/ZettaScaleLabs/zenoh-perf/tree/master/comparison/cyclonedds)
use [Eclipse Cyclone
DDS](https://github.com/eclipse-cyclonedds/cyclonedds) as
the target implementation. They are based on the [official DDS
examples](https://github.com/eclipse-cyclonedds/cyclonedds/tree/master/examples/roundtrip).
For the reliability QoS, RELIABLE was employed. For the history QoS,
while KEEP\_LAST was used in latency tests, KEEP\_ALL was selected for
throughput tests.

## Throughput Comparison

In the throughput tests, the publisher program publishes messages
back-to-back. The consumer program subscribed to the same topic collects
a set of messages and calculates the message rate (msg/s).
The procedure will be repeated multiple times for each payload size and
the median number is selected from the samples as the result [^median_vs_mean],
in which outliers are excluded from the samples beyond 1st and 99th percentiles.
The same procedure is applied to Zenoh, Cyclone DDS (briefly represented as
DDS below), MQTT, and Kafka. The bitrates (bit/s) were also calculated
based on the message rate and the payload size. In addition, the
`iperf` utility was also used to measure the ideal data rate from the
application layer between two peers. Various payload sizes from 8 bytes
to 512 MB were tested to see the trend of the throughput. Note that in
the charts below, the Y-axis is shown in the log scale for both the
message rate and bitrate. The statistics data can be found
[here](https://github.com/ZettaScaleLabs/zenoh-perf/tree/master/comparison#numerical-results).
Some of the numbers will be reported in the following
paragraphs for discussion purposes.

{{< figure-inline
    src="../../img/20230321-performance-comparison/plots/single/message_per_second.png"
    caption="Fig. 4 Throughput data in msg/s for the single-machine scenario"
    class="figure-inline"
    alt="Throughput data in msg/s for the single-machine scenario"
    width="100%" >}}

Fig. 4 shows the results for the single-machine scenario. From the
figure, we can see that Zenoh can reach up to more than 4M msg/s for
small payload sizes. Among the two lines for Zenoh, the peer mode
(indicated by `Zenoh P2P`) provides better results than that of the
client mode (marked by `Zenoh brokered`), because the data
transmission doesn't need to be relayed by the Zenoh router. DDS,
although slower, is relatively close to Zenoh and can still reach up to
2M msg/s. Note that in the charts, the Y-axis is in the log scale.

As for Kafka, it maintains a stable message rate between 56K to 63K
msg/s for payload sizes less than 2 KB and starts to decrease until the
last data that was successfully measured at the payload size of 512 KB.
On the other hand, MQTT has a slightly lower throughput between 33K to
38K msg/s before 32 KB of the payload size. However, it then starts to
reduce drastically and shows the worst performance number, although it
supports larger payload sizes compared to Kafka. However, Kafka in
principle should be able to support more payload sizes. The reason
behind the observed limitation is that the Kafka bindings we used failed
on extending the message size over 1 MB.

{{< figure-inline
    src="../../img/20230321-performance-comparison/plots/single/bit_per_second.png"
    caption="Fig. 5 Throughput data in bit/s for the single-machine scenario"
    class="figure-inline"
    alt="Throughput data in bit/s for the single-machine scenario"
    width="100%" >}}

Fig. 5 provides the throughput in bits-per-second (bit/s or bps). It
shows that Zenoh starts to saturate toward the ideal throughput
measured by `iperf` (at 76 Gpbs) for the payload size equal to or
larger than 4 KB. The peer mode `Zenoh P2P` can reach up to 67 Gbps.
For DDS, the highest throughput achieved is about 26 Gpbs. Kafka appears to
saturate at about 4\~5 Gbps when the payload size is larger than 16 KB.
For MQTT, it reaches up to \~9 Gbps at the payload size of 32 KB. The
performance degradation phenomenon of MQTT appeared in the tests
consistently. The reason behind this is still unknown and will be worth
further study in the future.

Overall, in this single-machine scenario, taking bitrate numbers for the
throughput comparison, considering the best numbers obtained from Zenoh,
DDS, Kafka, and MQTT, Zenoh peer mode achieves \~2x higher performance
compared to that of DDS and 65x and 130x for Kafka and MQTT at the
payload size of 8 bytes. Zenoh achieves peak performances at 8KB,
achieving more than 4x throughput than DDS, 24x than Kafka, and 27x than
MQTT. Finally, for a payload of 32 KB, Zenoh achieves more than 2x higher
throughput than DDS, 5x than MQTT, and 10x than Kafka.

The throughput across multiple machines over a 100 Gb Ethernet is shown
in Fig. 6 and Fig. 7. We will mainly focus on the bitrate results here.

{{< figure-inline
    src="../../img/20230321-performance-comparison/plots/multi/message_per_second.png"
    caption="Fig. 6 Throughput data in msg/s for the multiple-machine scenario"
    class="figure-inline"
    alt="Throughput data in msg/s for the multiple-machine scenario"
    width="100%" >}}

{{< figure-inline
    src="../../img/20230321-performance-comparison/plots/multi/bit_per_second.png"
    caption="Fig. 7 Throughput data in bit/s for the multiple-machine scenario"
    class="figure-inline"
    alt="Throughput data in bit/s for the multiple-machine scenario"
    width="100%" >}}

In the figure, `iperf` shows that the ideal throughput of the target
network is 44 Gpbs. The maximal bitrate is about 34 Gbps for
`Zenoh brokered` and 50 Gbps for `Zenoh P2P`, respectively. For
Cyclone DDS, its throughput ranking remains at number three in the
charts at 14 Gbps. On the other hand, MQTT\'s bitrates can reach up to \~9
Gbps at the payload size of 32 KB and then goes down, similar to the
single-machine scenario. For Kafka, its best bitrate number is 5 Gbps,
also at the payload size of 32 KB.

As a summary of the comparison, the results observed from the
multiple-machine scenario maintain a similar performance trend to the
single-machine results, showing that Zenoh outperforms DDS, Kafka, and
MQTT by several to tens of performance improvements.

## Latency Comparison

In the latency tests, the `ping` program publishes the ping message,
and the `pong` program replies with the same message upon receiving
the ping. The tested payload size is fixed at 64 bytes (aligned with
ICMP echo/reply), and the testing is performed in a back-to-back manner
to reduce the impact of the process scheduling and the context switches
induced by the underlying operating system. The latency is defined as
half of the median round-trip time covering the ping and pong
operations [^median_vs_mean].
Similarly, we remove the outliers beyond 1st and 99th percentiles.
The statistics data can also be found
[here](https://github.com/ZettaScaleLabs/zenoh-perf/tree/master/comparison#numerical-results).
Tab. 2 shows the results of the tests. The Linux `ping`
utility was included as a baseline of the minimum latency that can be
achieved.

Tab. 2 Latency data in µs (microseconds) for the single-machine and multiple-machine scenario

{{< table "table table-striped table-bordered w-auto" >}}
| Target           | Single-machine               | Multiple-machine               |
| ---------------- | ---------------------------- | ------------------------------ |
| Kafka            | 73                           | 81                             |
| MQTT             | 27                           | 45                             |
| Cyclone DDS      | 8                            | 37                             |
| Zenoh brokered   | 21                           | 41                             |
| Zenoh P2P        | 10                           | 16                             |
| Zenoh-pico       | 5                            | 13                             |
| ping             | 1                            | 7                              |
{{< /table >}}


For the single-machine environment, the ideal latency value obtained
from `ping` is 1 µs. MQTT and Kafka have a latency of 73 µs and 27 µs,
respectively. As for Zenoh, while the client mode `Zenoh brokered` has
a latency of 21 µs, mainly due to routing data through a middleman,
`Zenoh P2P` shows that it can be further reduced to 10 µs. For Cyclone
DDS, the latency is even lower than Zenoh, achieving down to 8 µs. The
reason is that it's using UDP Multicast. Although Zenoh currently hasn't
implemented the same data transport yet, the microcontroller
implementation of Zenoh -- `Zenoh-pico` -- has already realized this. As a
result, we've also tested its latency and the result is 5 µs, as
indicated by `Zenoh-pico`, which is even lower than that of Cyclone
DDS, mainly because the Zenoh protocol and its implementation can be
more lightweight and efficient than the OMG DDSI-RTPS protocol
(implemented by all DDS-compliant implementations).

For the multiple-machine scenario over a real network with 100 Gb
Ethernet, the latency for the `Zenoh brokered` is about 41 µs, and the
number of `Zenoh P2P` for the peer mode is 16 µs, which is lower than
that for Kafka at 81 µs, MQTT at 45 µs, and Cyclone DDS at 37 µs. For
`Zenoh-pico`, it remains the best one at 13 µs, closest to the
baseline obtained by the `ping` utility at 7 µs.

In general, the latency of Zenoh is low. Zenoh with the default
peer-to-peer mode has the shortest latency compared to MQTT and Kafka
(and DDS for the multiple-machine scenario). When the UDP Multicast
transport is supported by Zenoh, as the result indicated by Zenoh-pico,
it is expected that Zenoh can achieve the lowest number among all the
software.

## Conclusion

In this blog, we compared the performance of Zenoh, MQTT, Kafka, and
DDS. Zenoh consistently outperformed MQTT and Kafka. The results show
that Zenoh is relatively closer to the ideal numbers obtained by the
classic baseline tools `iperf` and `ping` for throughput and latency
evaluation from the application layer, thanks to the low overhead design
and multiple optimization techniques embedded in Zenoh's implementation.

In our evaluation, Zenoh achieved up to **67** Gbps throughput on
single-machine tests and **51** Gbps on multiple-machine tests with a 100
GbE network when the default peer mode was used. It can reach up to 1\~2
orders of magnitude improvement on MQTT and Kafka and could double the
throughput of DDS. One noticeable thing is that Cyclone DDS performed
the best in the latency tests of the single-machine scenario, due to its
use of the UDP multicast transport mechanism. However, when Zenoh-pico,
the microcontroller implementation of Zenoh which has also realized the
UDP multicast transport, is added to the comparison, it attains the
lowest latency in all cases. This capability will later be supported by
all Zenoh implementations.

Zenoh's goal is to provide a next-generation communication framework
with unparalleled performance and scalability. Besides being incredibly
performant, Zenoh was also the technology featuring the simplest API and
the shortest learning curve. We believe that Zenoh is the best choice
for industrial, IoT, robotics, and automotive applications that can
seamlessly support the cloud-to-edge and to-things continuum.

Hope you enjoyed it,

-- [**William**](https://github.com/william-wyliang), [**Circle**](https://github.com/YuanYuYuan), and [**Jerry**](https://github.com/jerry73204)
