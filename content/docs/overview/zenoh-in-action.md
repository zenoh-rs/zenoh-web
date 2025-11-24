---
title: "Zenoh in action"
weight: 1200
menu: 
    docs:
        parent: overview
---

Let us now look into a sample scenario of Zenoh working.
Zenoh supports two paradigms of communication - publish-subscribe and queries. 
<!-- The source is available at https://drive.google.com/file/d/1exhGofWDyiEIES_WICsslXWZ3yiTSkAl/view?usp=sharing (ATO/Techno/Slides/zenoh/2022/2022.09.08-zenoh-web-animation.key) 
Settings::: Resolution: Extra Large, Frame Rate 30 fps, Export with transparent backgrounds -->

- [Pub/Sub in Zenoh](#pubsub-in-zenoh)
- [Query in Zenoh](#queries-in-zenoh)

## Pub/Sub in Zenoh
![Zenoh pub/sub in action](/img/zenoh-pub-sub.gif "Zenoh pub/sub in action")

This animation shows a basic pub/sub in action. The subscribers connected to the system receive the values sent by the publishers routed efficicently through the Zenoh network.
You can also observe the presence of a sleeping subscriber connected to the network. Once the subscriber awakes, the nearest Zenoh node will send the pending publications.

## Queries in Zenoh
![Zenoh queries in action](/img/zenoh-query.gif "Zenoh queries in action")

This animation shows a simple query in action through Zenoh. You can see the presence of storages and queryables. 
A queryable is any process that can reply to queries. A storage is a combination of a subscriber and a queryable.

--

In the following sections, we introduce the primitives and abstractions in Zenoh that enables this sample scenario.