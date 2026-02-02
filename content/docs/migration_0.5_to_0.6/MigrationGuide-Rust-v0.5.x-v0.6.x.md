---
title: "Migrating from Zenoh v0.5.x Rust API to Zenoh v0.6.x Rust API"
weight : 5300
menu:
  docs:
    parent: migration_0.5_to_0.6
---

In zenoh version 0.6.0, zenoh and zenoh-net APIs have been merged into a single API.

## General considerations about the new Rust v0.6.x zenoh API

### Resolvables

Most of the operations of the new API return builder structs that implement the `Resolvable`, `SyncResolve` and `AsyncResolve` traits. A `res` function needs to be called on those builders to obtain the final result of the operation. When using Rust sync, the `SyncResolve` trait needs to be used and the `res` function directly returns the final result. When using Rust async/await, `AsyncResolve` trait needs to be used and the `res` function returns a `Future`.

*zenoh v0.6.x sync*
```rust
use zenoh::prelude::sync::*;
let session = zenoh::open(config).res().unwrap();
```

*zenoh v0.6.x async*
```rust
use zenoh::prelude::r#async::*;
let session = zenoh::open(config).res().await.unwrap();
```

## Migrating from Rust v0.5.x zenoh API to Rust v0.6.x zenoh API

### Session establishment

The zenoh session is now obtained through a `zenoh::open()` function.

*zenoh v0.5.x*
```rust
let zenoh = Zenoh::new(config).await.unwrap();
```

*zenoh v0.6.x*
```rust
let session = zenoh::open(config).res().await.unwrap();
```

### Workspace removed

The workspace has been removed. All operations are now directly accessible from the zenoh session itself. 

*zenoh v0.5.x*
```rust
let zenoh = Zenoh::new(config.into()).await.unwrap();
let workspace = zenoh.workspace(None).await.unwrap();
workspace.put(&key_expr, value).await.unwrap();
```

*zenoh v0.6.x*
```rust
let session = zenoh::open(config).res().await.unwrap();
session.put(&key_expr, value).res().await.unwrap();
```

### Path and PathExpr to KeyExpr

Types `Path` and `PathExpr` have been replaced by a single type `KeyExpr`.

### Subscribing

The `subscribe` operation has been replaced by a `declare_subscriber` operation. 
It now accepts any type that implements `TryInto<KeyExpr>` as parameter.

Note: `declare_subscriber` by default returns a `Handler` that derefs to a `flume::Receiver<Sample>`. 
Samples can be accessed through flume `recv` and `recv_async` operations. 
It is possible to access samples through a callback by calling the `callback` function on the subscriber builder.

*zenoh v0.5.x*
```rust
let mut change_stream = workspace.subscribe(&"/key/expression".try_into().unwrap()).await.unwrap();
while let Some(change) = change_stream.next().await {
    println!("Received {:?} {} : {:?}", change.kind, change.path, change.value);
}
```

*zenoh v0.6.x*
```rust
let subscriber = session.declare_subscriber("key/expression").res().await.unwrap();
while let Ok(sample) = subscriber.recv_async().await {
    println!("Received {} {} : {}", sample.kind, sample.key_expr, sample.value);
}
```

### Publishing

The `put` operation now accepts any type that implements `TryInto<KeyExpr>` as first parameter and any type that implements `Into<Value>` as second parameter.

*zenoh v0.5.x*
```rust
workspace.put(
    &"/key/expression".try_into().unwrap(),
    "value".into()
).await.unwrap();
```

*zenoh v0.6.x*
```rust
session.put("key/expression", "value").res().await.unwrap();
```

If needed the encoding or other options can be refined through a builder pattern.

*zenoh v0.6.x*
```rust
session
    .put("key/expression", "value")
    .encoding(Encoding::TEXT_PLAIN)
    .res()
    .await
    .unwrap();
```

### Querying

The `get` operation now accepts any type that implements `TryInto<Selector>` as first parameter.
It now returns some `Reply` instead of a some `Data`.

Note: `get` by default returns a `flume::Receiver<Reply>`. 
Replies can be accessed through flume `recv` and `recv_async` operations. 
It is possible to access replies through a callback by calling the `callback` function on the get builder.

*zenoh v0.5.x*
```rust
let mut data_stream = workspace.get(&"/key/expression/**".try_into().unwrap()).await.unwrap();
while let Some(data) = data_stream.next().await {
    println!("Received {} : {:?}", data.path, data.value)
}
```

*zenoh v0.6.x*
```rust
let replies = session.get("key/expression").res().await.unwrap();
while let Ok(reply) = replies.recv_async().await {
    match reply.sample {
        Ok(sample) => println!( ">> Received {}: {}", sample.key_expr, sample.value),
        Err(err) => println!(">> Received ERROR: {}", err),
    }
}
```

### Eval

The `register_eval` operation has been replaced by a `declare_queryable` operation. 
It now accepts any type that implements `TryInto<KeyExpr>` as parameter. 
The `reply_async` operation has been replaced by a `reply` operation that now accepts
a `Result<Sample>` as parameter.

Note: `declare_queryable` by default returns a `Handler` that derefs to a `flume::Receiver<Query>`. 
Queries can be accessed through flume `recv` and `recv_async` operations. 
It is possible to access queries through a callback by calling the `callback` function on the queryable builder.

*zenoh v0.5.x*
```rust
let mut get_stream = workspace.register_eval(&"/key/expression".try_into().unwrap()).await.unwrap();
while let Some(get_request) = get_stream.next().await {
   get_request.reply_async("/demo/example/eval".try_into().unwrap(), "value".into()).await;
```

*zenoh v0.6.x*
```rust
let queryable = session.declare_queryable("key/expression").res().await.unwrap();
while let Ok(query) = queryable.recv_async().await {
    query.reply(Ok(Sample::new(query.key_expr().clone(), "value"))).res().await.unwrap();
}
```

### Examples

More examples are available there : 

[*zenoh v0.5.0-beta9*](https://github.com/eclipse-zenoh/zenoh/tree/70d7b22f539a6f88dc54d4949114cef6ffdd1df9/zenoh/examples/zenoh)

[*zenoh v0.6.0*](https://github.com/eclipse-zenoh/zenoh/tree/main/examples/examples)


## Migrating from Rust v0.5.x zenoh-net API to Rust v0.6.x zenoh API

### zenoh::net module removal

All types and operations from the `zenoh::net` module have been moved to the `zenoh` module.

*zenoh-net v0.5.x*
```rust
let session = zenoh::net::open(config).await.unwrap();
```

*zenoh v0.6.x*
```rust
let session = zenoh::open(config).res().await.unwrap();
```

### Subscribing

The `declare_subscriber` now accepts any type that implements `TryInto<KeyExpr>` as parameter. 
It now only takes one parameter. Subscription configuration is performed with the help of a builder pattern.

Note: `declare_subscriber` by default returns a `Handler` that derefs to a `flume::Receiver<Sample>`. 
Samples can be accessed through flume `recv` and `recv_async` operations. 
It is possible to access samples through a callback by calling the `callback` function on the subscriber builder.

*zenoh-net v0.5.x*
```rust
let sub_info = SubInfo {
    reliability: Reliability::Reliable,
    mode: SubMode::Push,
    period: None
};
let mut subscriber = session.declare_subscriber(&"/key/expression".into(), &sub_info).await.unwrap();
while let Some(sample) = subscriber.receiver().next().await {
    println!("Received : {:?}", sample);
}
```

*zenoh v0.6.x*
```rust
let subscriber = session
    .declare_subscriber("key/expression")
    .reliable()
    .res()
    .await
    .unwrap();
while let Ok(sample) = subscriber.recv_async().await {
    println!("Received : {:?}", sample);
}
# })
```

### Subscribing with callback

The `declare_callback_subscriber` operation has been removed.
A `CallbackSubscriber` can now be declared by using `declare_subscriber` and calling the `callback` function on the returned builder.

*zenoh-net v0.5.x*
```rust
let sub_info = SubInfo {
    reliability: Reliability::Reliable,
    mode: SubMode::Push,
    period: None
};
let subscriber = session
    .declare_callback_subscriber(&"/key/expression".into(), &sub_info, |sample| {
        println!("Received : {:?}", sample);
    })
    .await
    .unwrap();
```

*zenoh v0.6.x*
```rust
let subscriber = session
    .declare_subscriber("key/expression")
    .reliable()
    .callback(|sample| {
        println!("Received : {:?}", sample);
    })
    .res()
    .await
    .unwrap();
# })
```

### Publishing

The `write` operation has been replaced by a `put` operation. 
It now accepts any type that implements `TryInto<KeyExpr>` as first parameter and any type that implements `Into<Value>` as second parameter.

*zenoh-net v0.5.x*
```rust
session.write(&"/key/expression".into(), "value".as_bytes().into()).await.unwrap();
```

*zenoh v0.6.x*
```rust
session.put("key/expression", "value").res().await.unwrap();
```

The `write_ext` operation has been removed. Configuration is now performed with the help of a builder pattern.

*zenoh-net v0.5.x*
```rust
session.write_ext(
    &"/key/expression".into(),
    "value".as_bytes().into(),
    encoding::TEXT_PLAIN,
    data_kind::PUT,
    CongestionControl::Drop,
).await.unwrap();
```

*zenoh v0.6.x*
```rust
session
    .put("key/expression", "value")
    .encoding(Encoding::TEXT_PLAIN)
    .kind(SampleKind::Put)
    .congestion_control(CongestionControl::Drop)
    .res()
    .await
    .unwrap();
```

The `declare_publisher` now accepts any type that implements `TryInto<KeyExpr>` as parameter. 
It now has a `put` operation that only takes any type that implements `Into<Value>` as parameter,
a `delete` operation that takes no parameter and
a `write` operation that takes both a `SampleKind` as first parameter and any type that implements `Into<Value>` as second parameter.

*zenoh-net v0.5.x*
```rust
let publisher = session.declare_publisher(&"/key/expression".into()).await.unwrap();
session.write(&"/key/expression".into(), "value".as_bytes().into()).await.unwrap();
```

*zenoh v0.6.x*
```rust
let publisher = session.declare_publisher("key/expression").res().await.unwrap();
publisher.put("value").res().await.unwrap();
```

### Querying

The `query` operation has been replaced by a `get` operation. 
It now accepts any type that implements `TryInto<Selector>` as single parameter instead of a key expression and a predicate. 
Finer configuration is performed with the help of a builder pattern.

Note: `get` by default returns a `flume::Receiver<Reply>`. 
Replies can be accessed through flume `recv` and `recv_async` operations. 
It is possible to access replies through a callback by calling the `callback` function on the get builder.

*zenoh-net v0.5.x*
```rust
let mut replies = session.query(
    &"/key/expression".into(),
    "predicate",
    QueryTarget::default(),
    QueryConsolidation::default()
).await.unwrap();
while let Some(reply) = replies.next().await {
    println!(">> Received {:?}", reply.data);
}
```

*zenoh v0.6.x*
```rust
let mut replies = session
    .get("key/expression?predicate")
    .target(QueryTarget::default())
    .consolidation(QueryConsolidation::default())
    .res()
    .await
    .unwrap();
while let Ok(reply) = replies.recv_async().await {
    match reply.sample {
        Ok(sample) => println!( ">> Received {}", sample.value),
        Err(err) => println!(">> Received ERROR: {}", err),
    }
}
```

### Queryable

The `declare_queryable` operation now accepts any type that implements `TryInto<KeyExpr>` as first parameter. 
It takes a single parameter. Finer configuration is performed with the help of a builder pattern.
The `reply_async` operation has been replaced by a `reply` operation that now accepts a `Result<Sample>` as parameter.

Note: `declare_queryable` by default returns a `Handler` that derefs to a `flume::Receiver<Query>`. 
Queries can be accessed through flume `recv` and `recv_async` operations. 
It is possible to access queries through a callback by calling the `callback` function on the queryable builder.

*zenoh-net v0.5.x*
```rust
let mut queryable = session.declare_queryable(&"/key/expression".into(), EVAL).await.unwrap();
while let Some(query) = queryable.receiver().next().await {
    query.reply_async(Sample{
        res_name: "/key/expression".to_string(),
        payload: "value".as_bytes().into(),
        data_info: None,
    }).await;
}
```

*zenoh v0.6.x*
```rust
let queryable = session.declare_queryable("key/expression").res().await.unwrap();
while let Ok(query) = queryable.recv_async().await {
    query.reply(Ok(Sample::new(query.key_expr().clone(), "value"))).res().await.unwrap();
}
```

### Examples

More examples are available there : 

[*zenoh-net v0.5.0-beta9*](https://github.com/eclipse-zenoh/zenoh/tree/70d7b22f539a6f88dc54d4949114cef6ffdd1df9/zenoh/examples/zenoh-net)

[*zenoh v0.6.0*](https://github.com/eclipse-zenoh/zenoh/tree/0.6.0-beta.1/examples/examples)