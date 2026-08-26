---
title: "Zenoh overhead: a story from our community"
date: 2021-07-05
menu: "blog"
weight: 20210705
description: "Paris — 5 July 2021"
draft: false
---

Zenoh's webpage states that zenoh has a minimal wire overhead of **5 bytes**. This is the result of careful considerations in the zenoh design: from using **Variable Length Encoding (VLE)**, to efficient **mapping of resource keys** and **automatic batching**.

If you are intrigued about this and want to know more, rest assured that you are not alone. In fact, the minimal overhead aspect of zenoh attracted a lot of attention and curiosity in our community that led to some interesting discussions on zenoh's [Discord Server](https://discord.gg/cY4nVjUd). 

Given the amount of messages and information exchanged, we thought it would be a good idea to write a blog post to explain how zenoh achieves this wire efficiency. It's easier to read a blog post than scrolling backwards many messages on Discord, isn't it?

## Minimal overhead: what is it?
Let's start from the beginning. We said that 5 bytes are the minimal overhead in zenoh. What does that mean? It means that zenoh adds at least 5 bytes to user payload but, as you might have guessed, it may also add more if necessary. You might be wondering now in which cases zenoh offers the minimal overhead. To answer these questions we should first have a look at how zenoh serializes data on the wire. 

As shown below, user payload is always carried in a zenoh data message. In turn, one or more zenoh data messages are carried within a zenoh frame message. The inner details of these messages and their corresponding weight in the 5 bytes overhead are presented in the following.

```
+-------+----------------+----------------+- ... -+
| FRAME | DATA(USER PLD) | DATA(USER PLD) |  ...  |
+-------+----------------+----------------+- ... -+
```

-------
## Zenoh data messages: carrying your data
In zenoh, users deal with keys/values where each key is a path and is associated with a value. A key looks like just a Unix file system path, such as `/myhome/kitchen/temp`, and it represents a resource. For what concerns the value, it can be defined with different encodings (string, JSON, raw bytes buffer, etc.). 

As a result, the data, i.e. the value, is always published to a given resource. Zenoh takes this information from the user, and it includes it in a zenoh data message as shown below. 
Particularly, the overhead in a zenoh data message is computed as follows:
- **1 byte** for the **data header**
- **1+ bytes** for the **resource**
- **1+ bytes** to encode the **user data length**

As you can see, the minimum overhead added by the zenoh data message is **3 bytes**.

```
 7 6 5 4 3 2 1 0
+---------------+          --+      --+
|  DATA HEADER  | 1 byte     |DATA    |OVERHEAD
+---------------+            |        |     
~   RESOURCE    ~ 1+ bytes   |        |
+---------------+            |        |
~ USER PLD LEN  ~ 1+ bytes   |        |
+---------------+            |      --+
~   USER PLD    ~ 1+ bytes   |      
+---------------+          --+      
```

### Variable Length Encoding: a compact integer representation

But how can we get exactly 3 bytes of overhead? Let's start by looking at the user data length, which takes 1+ bytes. 
This field contains the number of bytes of user payload and represents a *64-bit integer*. 
Its particularity is that it is encoded as variable-length (VLE), meaning that the footprint on the wire depends on its value. 

As you can imagine, a 64 bit integer always takes 8 bytes when encoded as is. Instead, while encoded as VLE the size on the wire depends on its value. For instance,  encoding the value 64 always takes 1 byte on the wire even if it is a 64-bit integer. 

According to VLE encoding, with the first byte you can encode up to the value `2^7-1`, i.e. 127. 
This means that when the user payload is shorter than 128 bytes, the space taken to encode its length is only **1 byte**. 


#### Smart mapping of resource keys: using IDs

Next, let's have a look at the resource field that encodes the resource key, which is represented by an arbitrary long key. This is very handy for the user who is completely free to define his own key structure, as complex and nested as he wants to be. However, transmitting the whole key without any transformation is not wire efficient at all. 

For this reason, in zenoh we have a mechanism to do some dynamic mapping between the complete string form of the key into a more compact integer form, called simply resource ID. This means that we have a wire-efficient mapping for identifying resources departing from simple integers sent on the wire. 
This resource ID is then encoded as VLE, thus the possibility to use only 1 byte. 

In order to use this wire-efficient representation you may need to use the `declare_resource()` primitive in zenoh, which does exactly that under the hood.
The following Python code will send data messages with only 3 bytes overhead.

```python
session = zenoh.net.open(conf)
rid = session.declare_resource("/myresource")
session.write(rid, "This is my payload")
```

Summarizing, the minimal overhead in data messages is as little as **3 bytes** when the `declare_resource()` primitive is used and small payloads are sent. 

-------
## Zenoh frame messages: batching your data
So far we have discovered where 3 bytes out 5 of zenoh overhead come from. Where are the other 2? Those come from the frame message which always encapsulates one or more data messages as shown below.  Particularly, the frame overhead is computed as follows:
- **1 byte** for the **frame header**
- **1+ byte** for the **sequence number (SN)**

```
 7 6 5 4 3 2 1 0
+---------------+          --+       --+
| FRAME HEADER  + 1 byte     |FRAME    |OVERHEAD
+---------------+            |         |
~ SEQUENCE NUM  ~ 1+ bytes   |         |
+---------------+            |       --+
~    DATA MSG   ~ 3+ bytes   |
+---------------+            |         
       ...                  ... Multiple data messages
+---------------+          --+
```

### Configurable Sequence Number resolution: just the right size
By default, zenoh uses 4 bytes resolution for the SN giving an upper bound to the SN to `2^28-1`. 
As you might have imagined by now, the SN is encoded as VLE resulting in an actual wire overhead of 1, 2, 3 or 4 bytes depending on the SN value. 

The default SN resolution is chosen to deal with high throughput transmissions. Indeed, the larger the SN window, the more messages you can have on the fly at the same time. 
But what if we are not interested in transmitting at high rate but we are rather operating over constrained networks? If that's the case, you can reduce the SN resolution to 128 (i.e. `2^7`) so as to always use **1 byte** when encoding the SN. 

It's important to remark that in zenoh the SN resolution is local to a single hop. 
By doing so, you can optimize the SN resolution on the first hop over a constrained network while having a larger SN resolution in the routing backbone and optimize the throughput! 

Assuming that we want to configure a SN resolution of 128, a zenoh configuration can be written as follows:

```
seq_num_resolution=128
```

Let's assume the above configuration is then saved with the name savebandwidth.conf. 
Then, you can test this configuration with a zenoh pub sub example as follows:

```sh
$ git clone git@github.com:eclipse-zenoh/zenoh.git
$ cd zenoh
$ cargo build --release --examples
```

Then, let's start a subscriber in a first terminal window:

```sh
$ ./target/release/examples/zn_sub -c savebandwidth.conf
```

And let's start a publisher in a second terminal window:

```sh
$ ./target/release/examples/zn_pub -c savebandwidth.conf
```

Hurray! You are now using only 1 byte for the SN. You can verify that by running the above examples by setting the environment variable `RUST_LOG=debug`.
You should be able to a log similar to the following: 

```[2021-06-18T07:26:05Z DEBUG zenoh::net::protocol::session::manager] New session opened with 7FB1570440474917BD5B326F5A7BCFA9: whatami 2, sn resolution 128, initial sn tx 60, initial sn rx 81, is_local: true```

If you see `sn resolution 128`, it means that the desired SN resolution has been configured.

### Automatic batching: everybody on-board!
There is another nice feature that zenoh offers in terms of optimizing overhead. 
And probably the most important one: automatic batching. 

When there are multiple data messages ready to be sent, zenoh packs multiple data messages within the same frame in such a way the overhead introduced by the frame header and SN is added only once. 
So, this operation is done transparently and it doesn't require any user intervention. 
Very neat, isn't it? But that's not all yet!

Automatic batching enables additional savings (and probably the most important ones) in terms of bandwidth savings: it reduces the overhead from underlying network layers (e.g., TCP/IP). 
By packing all the user messages, only one syscall per frame is then made. 
This leads to the fact that the overhead of the underlying layers is only added once per frame and not per data message. 
This is a not-negligible savings especially for small user payload: up to thousands of small messages can fit in a single frame! 


-------
## Conclusions

Summarizing, the minimal overhead in frame messages is as little as 2 bytes when the SN resolution is bounded to 128. 
Moreover, the overhead of the SN (even the larger ones) are then equally shared across all the data messages in a single frame, leading to considerable bandwidth savings also in high throughput scenarios when batching comes really into play. This leaves us with a minimal overhead of just **5 bytes** when a single message is sent.

If you liked this blog post and you have more questions or simply curiosities on zenoh, don't hesitate to join our community on zenoh's [Discord Server](https://discord.gg/cY4nVjUd)!


[**--LC**](https://github.com/Mallets/)
