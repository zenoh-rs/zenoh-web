---
title: "Migrating from Zenoh v0.5.x Python API to Zenoh v0.6.x Python API"
weight : 5500
menu:
  docs:
    parent: migration_0.5_to_0.6
---

## Explorability

In previous releases, the Python bindings were entirely defined in Rust, making it very hard for Pythoners to explore it.

With 0.6, the bindings have evolved: a "private" layer is exposed by Rust, and wrapped in Python, with 2 main advantages:
- IDEs can now find available symbols, signatures and documentation more easily.
- Any dynamic type handling is done in Python, letting you investigate what happens depending on the types of values you pass more easily.

## Handling RAII

The bindings are generated through `pyo3`, which among other things ensures that the destructors of the wrapped Rust types get called when a value becomes inaccessible.

This may lead to somewhat surprising behaviours coming from Python, where RAII is uncommon, as this implies that, for instance, subscribers will be undeclared as soon as no variable points to them anymore.

A typical case for that is `subscriber = session.declare_subscriber("key/expr", callback)`: unless that `subscriber =` is there, the subscriber will indeed be declared, but it will be
undeclared the moment the method returns.

This has always been the case, but we never addressed this much in documentation.

## API Changes
### The KeyExpr class

You'll notice that `KeyExpr` is a recurring type in the new API: it represents a valid Key Expressions.

While you can keep using strings for any function `IntoKeyExpr`, constructing a `KeyExpr` allows you to make sure that string is a valid key expression sooner, and allows Zenoh to bypass checking that when you use it.

### Subscribing

The `declare_subscriber` operation now accepts more than just callbacks.

*zenoh v0.5.x*
```python
subscriber = session.declare_subscriber("/key/expression", callback)
```

*zenoh v0.6.x*
```python
# you can pass a callback
subscriber = session.declare_subscriber("key/expression", callback)
# you can also pass a `zenoh.Queue`, to consume data in a for-loop (note that until subscriber is undeclared, that loop will never end)
subscriber = session.declare_subscriber("key/expression", zenoh.Queue())
for sample in sub.receiver:
        print(f">> [Subscriber] Received {sample.kind} ('{sample.key_expr}': '{sample.payload.decode('utf-8')}')")
```

### Publishing

The `put` operation's API is mostly the same, but you can now also `declare_publisher`s when you expect to publish data on the same key a lot.

### Querying

`get` no longer returns a list of samples, but instead accepts a handler, the same way `declare_subscriber` does.

While this appears less convenient, it does solve a couple issues:
- You don't need to wait for every reply to arrive before processing the earliest ones.
- You don't have to store all replies at once, relieving pressure on your memory.
- You don't have to block while waiting for all replies to arrive.

*zenoh v0.5.x*
```python
replies = session.get("/key/expression/**")
for reply in replies:
    print(f"Received {reply.sample.key_expr} : {reply.sample.payload.decode('utf-8')}")
```

*zenoh v0.6.x*
```python
query = session.get("key/expression", callback)
```

If you liked the old behaviour better, you can use `zenoh.ListCollector` to get a very similar one:
```python
replies = session.get("key/expression", zenoh.ListCollector())
for reply in replies(): # Note that with ListCollector, `get` returns a closure that will return the data once it's all collected
    try:
        print(f">> Received ('{reply.ok.key_expr}': '{reply.ok.payload.decode('utf-8')}')")
    except:
        print(">> Received an error)
```

Queries are now guaranteed to only receive replies whose key expressions intersect with the queried one.

An API to disable this restriction will be introduced in the near future. Please let us know if that is of interest to you.

### Eval

The `register_eval` operation has been replaced by `declare_queryable`.
Like the `declare_subscriber`, you can now pass handlers that aren't just callbacks.

*zenoh v0.5.x*
```rust
eval = session.register_eval("/key/expression", callback)
```

*zenoh v0.6.x*
```rust
queryable = session.declare_queryable("key/expression", callback)
```

Note that queryables (the new name for evals) must now reply on key expressions that intersect with the queried one (and will raise an exception otherwise),
unless the query specifically allowed replies on any key expression.

At the moment, there is no stable API to check whether a query allows such replies. An API to do so will be introduced in the near future.

### Examples

More examples are available there : 

[*zenoh v0.5.0-beta9*](https://github.com/eclipse-zenoh/zenoh/tree/70d7b22f539a6f88dc54d4949114cef6ffdd1df9/zenoh/examples/zenoh)

[*zenoh v0.6.0*](https://github.com/eclipse-zenoh/zenoh/tree/0.6.0-beta.1/examples/examples)


## What about Zenoh Net?

Zenoh Net was removed, as Zenoh's API has shifted to a more declarative style which allows us to optimize Zenoh for you without causing breaking changes repeatedly.

With API stability as one of our main goals, maintaining a low level API such as Zenoh Net will either be too constraining, or too human-ressource intensive.

We suspect most Python users were not using Zenoh Net much. If you are a Zenoh Net Python user in need of help migrating to the new API, feel free to ping us on [Discord](https://discord.gg/cY4nVjUd).