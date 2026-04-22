---
title: "Using ReductStore as a Zenoh storage backend"
date: 2026-04-23
menu: "blog"
weight: 20260423
description: "23 April 2026 -- Hamburg."
draft: false
---

[ReductStore](https://www.reduct.store) is an open source time series
object store. It can persist time series data of any size and type:
small JSON telemetry, camera frames, LiDAR point clouds, audio
chunks, or anything else you can encode as bytes. Starting with version 1.19, it
ships a native Zenoh plugin: a ReductStore instance can join a Zenoh
network as a regular peer, subscribe to key expressions, persist
every sample it receives, and answer `get()` queries on the same key
space. No bridge process, no extra protocol.

The data models line up well. A Zenoh sample is published on a key
(e.g. `robot/arm/joint1`) and carries a timestamp, a payload, and an
optional attachment. A ReductStore record is stored under an entry
name and carries a timestamp, an arbitrary size payload, and a set of
labels. Same structure, different taxonomy. The mapping between the
two is almost one to one:

| Zenoh sample | ReductStore record |
|--------------|--------------------| 
| Key          | Entry name         |
| Timestamp    | Timestamp          |
| Payload      | Payload            |
| Attachment   | Labels             |

Key expressions (wildcard patterns like `robot/**`) are used on the
ReductStore side to configure which keys the subscriber and queryable
respond to.

This post walks through a small runnable example (two simulated
robots, a gateway, one ReductStore instance, and a remote query
client) and highlights four patterns that work well together.
Everything is in
[github.com/reductstore/zenoh-example](https://github.com/reductstore/zenoh-example);
`docker compose up` and you can follow along.

## The setup

```
┌──────────────┐
│ robot alpha  │  robot/alpha/*
│              ├──┐
└──────────────┘  │        ┌───────────────┐     ┌──────────────┐
                  ├───────▶│  zenoh router ├────▶│  ReductStore │
┌──────────────┐  │        └───────┬───────┘ sub │  bucket:     │
│ robot beta   │──┘                │         qry │    fleet     │
│              │  robot/beta/*     │             └──────┬───────┘
└──────────────┘                   ▼                    │
                            ┌────────────┐          HTTP 8383
                            │ remote app │              │
                            │  get(...)  │              ▼
                            └────────────┘       Web console +
                                                  HTTP clients
```

Each robot publishes to `robot/<id>/camera` (JPEGs at 2 Hz) and
`robot/<id>/telemetry` (JSON at 10 Hz). ReductStore connects to the
router as a Zenoh client and both subscribes and answers queries on
`robot/**`. The whole integration is environment variables:

```yaml
reductstore:
  image: reduct/store:latest  # v1.19+ has a native Zenoh API
  environment:
    RS_ZENOH_ENABLED: "true"
    RS_ZENOH_CONFIG: "mode=client;connect/endpoints=[tcp/zenoh-router:7447]"
    RS_ZENOH_BUCKET: "fleet"
    RS_ZENOH_SUB_KEYEXPRS: "robot/**"
    RS_ZENOH_QUERY_KEYEXPRS: "robot/**"
  ports:
    - "8383:8383"
```

Robots write the way they already do. The Zenoh attachment on a
sample becomes record labels on the ReductStore side:

```python
labels = {"robot": ROBOT_ID, "status": t["status"]}
pub.put(
    json.dumps(t).encode(),
    encoding=zenoh.Encoding.APPLICATION_JSON,
    attachment=json.dumps(labels).encode(),
)
```

## What you get

### 1. Query by time range and by condition

ReductStore hooks into Zenoh's `get()`. The selector carries a time
window, and a JSON attachment carries a condition on labels. Both are
evaluated on the storage side before bytes cross the network.

Time range:

```python
selector = f"robot/alpha/telemetry?start={start_us};stop={stop_us}"
replies = session.get(
    selector,
    consolidation=zenoh.ConsolidationMode.NONE,
)
```

`ConsolidationMode.NONE` is the important bit. Zenoh's default
consolidates replies to one per key. For a time series you want
every record, so consolidation has to be off.

Conditional filter on labels:

```python
attachment = json.dumps({"when": {"&status": {"$eq": "warn"}}}).encode()
replies = session.get(
    f"robot/alpha/camera?start={start_us};stop={stop_us}",
    attachment=attachment,
    consolidation=zenoh.ConsolidationMode.NONE,
)
```

"Every camera frame from the last ten minutes where status was warn"
is one `get()`. No client side filtering.

### 2. Queries work over the network

Zenoh routes queries. A `get()` from a remote laptop does not need to
know where the storage lives; the router forwards it to whichever
peer answers for the key.

Same client code whether it runs next to the gateway or across the
WAN:

```bash
# on the gateway
python query_zenoh.py --robot alpha --last 60

# on a laptop somewhere else
python query_zenoh.py --robot alpha --last 60 \
    --endpoint tcp/gateway.example.com:7447
```

Storage can sit on the robot, on the gateway, or in the cloud. The
caller's code is the same in all three cases. The port that already
carries live data also carries history. `RS_ZENOH_QUERY_LOCALITY`
lets you restrict whether the storage answers local queries, remote
queries, or both.

```
   site A gateway       site B gateway         cloud site
 ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
 │ zenoh router  │◀──▶│ zenoh router  │◀──▶│ zenoh router  │
 │ ReductStore A │    │ ReductStore B │    │ ReductStore   │
 │  robot/A/**   │    │  robot/B/**   │    │   robot/**    │
 └───────▲───────┘    └───────▲───────┘    └───────▲───────┘
         │ robots A           │ robots B           │
                                              operator laptop
                                        get("robot/**?start=…")
```

### 3. FIFO quota

ReductStore buckets support a FIFO quota: set a size, and the oldest
blocks are dropped to make room for new ones.

```yaml
# on the edge instance
environment:
  RS_BUCKET_1_NAME: "fleet"
  RS_BUCKET_1_QUOTA_TYPE: "FIFO"
  RS_BUCKET_1_QUOTA_SIZE: "50GB"
```

The bucket stays at 50 GB. `HARD` mode refuses new writes instead of
dropping old ones, if that is what you need.

### 4. Label based replication to the cloud

A replication task is a background worker on the source instance. It
watches new writes, filters by entry name and by label, and forwards
matches to a destination ReductStore.

```yaml
# on the edge instance: forward only warn events and their frames
environment:
  RS_REPLICATION_1_NAME: "warn_to_cloud"
  RS_REPLICATION_1_SRC_BUCKET: "fleet"
  RS_REPLICATION_1_DST_BUCKET: "fleet"
  RS_REPLICATION_1_DST_HOST: "https://reduct.example-cloud.com"
  RS_REPLICATION_1_DST_TOKEN: "${CLOUD_TOKEN}"
  RS_REPLICATION_1_ENTRIES: "robot/*/camera,robot/*/telemetry"
  RS_REPLICATION_1_WHEN: '{"&status": {"$eq": "warn"}}'
```

The filter language is the same `when` from point 1. You label a
record once, at ingest, and the same label drives the read query,
the retention policy, and the replication rule.

```
 ROBOT             EDGE GATEWAY                   CLOUD
 ─────             ──────────────────             ───────────────
                  ┌───────────────────┐          ┌───────────────┐
  pub ──zenoh──▶  │ ReductStore       │ replicate│ ReductStore   │
                  │ bucket: fleet     │─ filter ▶│ bucket: fleet │
                  │ FIFO quota 50 GB  │  when=   │ (warn subset) │
                  └───────────────────┘   warn   └───────────────┘
```

## Try it

```bash
git clone https://github.com/reductstore/zenoh-example
cd zenoh-example
docker compose up --build
open http://localhost:8383    # web console, token: reductstore
```

Then:

```bash
cd query && pip install -r requirements.txt
python query_zenoh.py --robot alpha --last 60
python query_zenoh.py --robot alpha --last 600 --only-warn
```

## References

- Zenoh: <https://zenoh.io>
- Zenoh first app: <https://zenoh.io/docs/getting-started/first-app/>
- ReductStore: <https://www.reduct.store>
- ReductStore + Zenoh: <https://www.reduct.store/docs/integrations/zenoh>
- Replication tasks: <https://www.reduct.store/docs/guides/data-replication>
- Example on GitHub: <https://github.com/reductstore/zenoh-example>
