---
title: "Key Expression: Addressing infinite ressources at (Zetta)scale"
date: 2023-04-03
menu: "blog"
weight: 20230403
description: "03 April 2023 -- Paris."
draft: false
---
One of the major changes introduced by Zenoh 0.6 Bahamut was a new definition of the [Key Expression Language](https://github.com/eclipse-zenoh/roadmap/blob/main/rfcs/ALL/Key%20Expressions.md).
With Zenoh 0.7.1, we introduce new data structures that let you interact with this language more easily than ever before.

Come with me on a journey into Zenoh's vision of a Named Data Address Space: Key Expressions (KE). The major parts of this post are all rather independent, so feel free to skip past one if it's not to your taste.

# What are Key Expressions?

Before we talk about _expressions_, let talk about _keys_.
Much like telephone networks have numbers and Internet has IP addresses, Named Data protocols all have their address space, and elements of that space have been known by many names: "demon slayer" (probably not), "topic", "path", "name". We call them "keys", in reference to the fact that one of Zenoh's goals is to allow the easy setup of distributed Key-Value stores.

Early in Zenoh's design, we found that the ability to act not just on a single key, but on a whole set of keys in one operation was a very powerful concept; be it to reduce network usage, or to address keys that we don't _specifically_ know of, but that belong to a known set.

To do so, a "wildcard" syntax similar to those of glob patterns was introduced, and the Key Expression Language (KEL) was born.

## Specifying the KEL.

But there still was a major caveat: the language was largely underspecified, leaving the behaviour of certain patterns up to interpretation. To remedy this, we went the way most languages tend to, and stopped considering any text string as a valid KE, by defining a proper language for KEs.

This one done in a classic 3 steps program: make KEs better, ???, profit. Want the actual steps?
1. Redefine KEs as a `/`-separated list of non-empty UTF-8 strings called "chunks". With this, the ambiguities (and many internal debates) about the expected behaviours of `a/b/` and `a//b` in relation to `a/b` were finally laid to rest, since only the latter was a valid KE.
2. Make the wildcards special chunks, and not special characters. That way `*` now means "any chunk", and `**` means "any amount of any chunks". By raising them above the character level, we make the syntax easier and the parser (which has to be used _a lot_ for routing) faster. `a/*` will intersect with `a/b` and `*/c`, but not with `b/c` nor `a/b/c`. `a/**/c` will intersect with `a/b/c`, but also `a/b/d/c` and `a/c`.
3. To keep the ability to have sub-chunk wilds we define `$*` as the subchunk equivalent of `*`: it matches any amount of any characters, but cannot expand accross chunks: `a$*/c` will intersect with `ab/c`, but not with `ba/c`. Actually, let's also reserve `$` as the marker for future sub-languages that will allow more precise sub-chunk expressions.
4. (I lied about the program having 3 steps)<span style="width:2em;"/> Make KEs bijective: by introducing a set of substitution rules to convert certain wildcard combinations into semantically identical combinations, and enforcing that these rules be applied until the expression is stabilized before considering it a valid KE, we can ensure that any KE is the only one that describes its exact set of keys.  
    For example, `*/**/*`, `*/**/**/*` and `**/*/*/**` would mean the same thing (the set of all keys that are made of at least 2 chunks), but by repeatedly applying the `**/* -> */**` and `**/** -> **` rules, they all come down to the same `*/*/**`.

With steps 1 and 2, ambiguities in the language disappear. With step 3, we gain extensibility for future features, which will one day allow us to express more precise sets than currently possible. But step 4 is the true hero of the story: thanks to bijectivity, there's no longer a need to worry about different strings meaning the same thing, which may have trapped many people that haven't spent the last year obsessing over KEs. Bijectivity also greatly simplifies the implementation of data structures tailor-made for KEs, such as the one we'll explore in the next part.

# The KE Tree: a Zenoh flavoured data structure.

One thing you might have noticed is that with all these slashes, KEs definitely take after paths. One other aspect they take from paths is their intrisic hierarchical nature: like most good address spaces, KEs are hierarchical.

And what data-structure rhymes with hierarchy? The section title spoiled it, it's the _tree_. But the KeTree isn't just any old tree: it's a tree that's made to help you treat KEs as the sets they represent, complete with _intersection_ and _inclusion_ comparisons.

## Wait, what does it mean for KEs to _intersect_ and _include_?

Glad you asked, inner monologue of my future reader, forcing you to read this question in your mind was definitely helpful!

As aluded to repeatedly in this post, KEs define sets of keys, and operations in Zenoh are addressed by KE, so they affect sets of things. In fact, there are four ways an operation on a KE can affect data associated with a given KE:
1. If the KEs define disjoint sets (where there doesn't exist a key that belongs to both), they just don't interact.
2. If the operation KE and the existing data's KE define sets that have keys in common, like `a/*` and `*/b` both contain the `a/b` key, they are said to _intersect_. That means the operation will affect at least a subset of the existing data. Intersection is always symmetric: A intersects with B implies that B intersects with A.
3. If the operation KE's set contains all keys defined by the existing data's KE, the operation KE is said to _include_ the existing data KE. This means that the operation will affect _all_ of the existing data. Note that inclusion is generally asymmetric, but that "A includes B" or "B includes A" implies that "A and B intersect".
4. If the operation KE and data KE define the same set, they are equal. This is the only situation where inclusion is symmetrical, and thanks to our previously discussed [3 steps program](#specifying-the-kel), this is equivalent to string equality.

Intersection is often the most important comparison, since it means that things addressed by two KEs have to interact in some way, because they share a region of interest. This is the criterion that Zenoh uses to route samples to subscribers, and you'll likely use this criterion too, applied to your business logic, when working with queryables.

Inclusion is a bit more "optimizy": if some writes to A that includes B and C, the records for B and C may be erased, since A has now taken over both of their regions of interest.

Equality and disjunction are generally not very useful: equality because inclusion is generally sufficient for most optimizations, and disjunction because it usually just means that two things do not care about each other, which we in turn don't care about.

## Can we go back to the subject at hand now?

Ah, yes. Well, KE trees are just a data structure that lets you efficiently insert and fetch values associated to a KE by equality, but also lets you iterate over KE-value pairs that have KEs that are either intersecting with or included by your query in the fastest manner available. While most of their performance at scale can be attributed to their tree-like structure, they also employ various techniques to reduce the linear factors in CPU-time consumption.

While there are some interesting things to say about its implementation, its main interest for this current post is that it exists, and will help you handle sets of KE-value pairs in a KE-compliant way much more efficiently and easily than rolling your own implementation (if you disagree, feel free to make your own data structure that does that better, and don't forget to send it to us in a PR, Zenoh is always open to contributions).

Its current implementations are made in a few ways that may warrant blog posts that are more Rust-centric, in which we'll also delve deeper into how to use them. If you have questions about it, be it Rust-centric or about the abstract concept of a KE Tree, feel free to [join our Discord](discord) and ask.

For now, there exists two categories of KeTrees:
- Fully owned trees (`KeBoxTree`) own all of their nodes. This means you won't be able to safely keep references to its nodes, but they're simpler to use and generally fit well where you would have normally used a `HashMap`.
- Shared ownership trees, such as `KeArcTree`, allow you to keep references to their nodes outside the tree. `KeArcTree` leverages [`token_cell`](https://crates.io/crates/token-cell) to allow sharing ownership of its nodes and safely mutating it, without needing distinct mutexes on each node. We have plans to experiment with a `petgraph`-based KeTree, which will likely offer the exact same API, using the graph itself as the token, and the node indices as nodes.

Here's what it looks like to use a KeTree:
```rust
let mut tree = KeBoxTree::new();
tree.insert(keyexpr::new("a/b").unwrap(), 1);
tree.insert(keyexpr::new("a/c").unwrap(), 2);
tree.insert(keyexpr::new("b/c").unwrap(), 3);
let intersection = tree.intersection(keyexpr::new("a/**").unwrap());
// intersection is an iterator which will yield the nodes for "a",
// "a/b" and "a/c", which will have weights `None`, `Some(1)` and `Some(2)`
// respectively. The order isn't guaranteed.
```

# Good addressing with Key Expressions...

Now that you're all caught up on KEs and all of their wonderful properties, let's finally talk about some guidelines that you can follow to design easy to use APIs around your KEs, while lightening the load on our infrastructure to keep getting the best performance.

<ol>
<li>With great declarations, come great ressource costs: Zenoh operations that are titled <code>declare</code> imply that you are creating state on the infrastructure. No need to panic, that's what your infrastructure is for. One nice property of KE Trees is that as long as they aren't storing any wild KEs (KEs that contain wildcards), they can shortcut intersection and inclusion into a simple fetch, which is generally much faster than iterating. Note that this of course depends on your specific needs: if you end up using only wild KEs in your puts and queries to compensate for not declaring wild KEs, all of these puts and queries won't be able to take the shortcut either, but the iteration through intersection will have many more steps.</li>
<li>Make your KEs reflect your data model: it may sometimes help you to think of a Zenoh infrastructure as a distributed database. Any time you create a new KE format, try to follow the tennants of [Normal Forms](https://en.wikipedia.org/wiki/Database_normalization) that DB engineers have been following for years.</li>
<li>Give yourself room to grow: often, your requirements will change during the development of a project. Try to plan ahead and not setup traps for your later self. For example, if some of your operations are done on <code>**</code>, or other fully wild KEs, you're technically consuming your entire address space, which means there won't be any left when you want to add new features, or you'll have to resort to receiver-side filtering. Much like the creation of the universe, occupying the entire address space will make many a lot of people very angry and will be widely regarded as a bad move.</li>
<li>Sort your KE's chunks by variance: Zenoh nodes will construct a mapping of integers to string with their neighbours, and encode KEs as a prefix-id/suffix-string pairs. This means that the more your KEs share a common non-wild prefix, the smaller they will become on the network.</li>
<li id="rule5">Separate the "typing" chunks from the "addressing" chunks by a predefined chunk: this helps a lot with the seemingly conflicting natures of rules 3 and 4. By turning <code>org/${org:*}/factory/${factory:*}/path/${path:**}</code> into <code>org/factor/path/-/${org:*}/${factory:*}/${path:**}</code>, you gain the ability to later add <code>org/factor/path/extension/-/${org:*}/${factory:*}/${path:**}/${extension:*}</code> to your address space without disrupting the pre-existing one, whereas the former pattern's naive extension would have been <code>org/${org:*}/factory/${factory:*}/path/${path:**}/extension/${extension:*}</code>, which is included in the first <code>org/${org:*}/factory/${factory:*}/path/${path:**}</code>, and may therefore cause conflicts in your system's semantics.</li>
<li>Insert versionning somewhere in your address space: you never know when you'll paint yourself into a corner with an address space, so it's always useful to be able to switch to a new one that's orthogonal from the previous one to avoid old subsystems messing up your brand-new address space.</li>
<li>Don't put _everything_ in the address-space: you may be tempted to put every parameter of your queries in the KE, but unless you want those parameters to affect routing, it's usually more relevant for them to be in the <code>query</code>'s <code>parameters</code>. The same goes for publication: non-routing parameters should probably stay in the <code>value</code>.</li>
<li>Better safe than sorry: you may start thinking that I'm putting too much weight on all this, but keep in mind that distributed systems tend to grow big, and sometimes have low-bandwidth communication between the maintainers of their sub-systems. Do not underestimate how hard address space mismanagement could bite you: maybe you won't mess the address space up, but are you sure every member of the project will be as dilligent?</li>
</ol>

# ...and never breaking it with KE formats!
You may have noticed a strange format in [rule 5](#rule5): it's not just a shorthand that we've been using internally to discuss KE-formats, but the actual KeFormat syntax!

The KeFormat syntax is basically just a small extension of the KEL: on top of the usual chunks, it accepts `${id:pattern#default}` chunks that serve as placeholders that you intend to substitute when using the format. These placeholder chunks are called "spec-chunks".

Once you've defined a format, you can construct as many formatters that use it as you like. These formatters behave much like hashmaps where the only valid keys are the `id`s you've given to each spec-chunk, with an added guarantee: when you assign a value to an `id`, the formatter will ensure that the provided value is included in the corresponding spec's `pattern`. Once you've set all of your formatter's fields, you can `build` a KE from it, and use it with the knowledge that it abides by the format you specified.

You can also use your format to parse KEs you've received from the network: gone are the days of splitting and indexing. Note that some formats may be able to parse a KE in a few different ways when you have multiple `**` in your format: while there are plans to address these use cases in the future with iterable parsers that would let you check out each way your format could parse a given KE, the current `format.parse(key)` will always parse lazily (i.e. the next chunk will always have priority over `**` to consume chunks from `key`)

For now, KeFormats are only available in Rust, but they will join the C and Python APIs soon. In the meantime, let me show you how to use them in Rust, since the bindings will largely emulate that behaviour with whatever the languages make available to us.

## Formats
To start interacting with a format, you need to define it. There are two ways to do that:
- At runtime, you can construct a `zenoh::key_expr::format::KeFormat<'a>` that borrows from a `&'a str`, or an `OwnedKeFormat` that owns its spec. _Ex:_ `let temperatures = KeFormat::new("factory/temperature/sensor/-/${factory:*}/${sensor:*}").unwrap()`;
- At compile time, you can use the `zenoh::kedefine` macro to define any number of formats statically, as modules: this approach is highly encouraged because it will let you know at compile time if your format specification is valid, and make _using_ the defined formats much easier. _Ex:_ `zenoh::kedefine!(pub temperatures: "factory/temperature/sensor/-/${factory:*}/${sensor:*}");`

## Formatters
From any given format, you can construct a formatter which will let you incrementally construct your KEs based on that format:
- With runtime formats:
    ```rust
    let mut formatter = temperatures.formatter();
    let ke = formatter.set("factory", 5).unwrap()
                      .set("sensor", 42).unwrap()
                      .build().unwrap();
    // `formatter` can still be used after this, but it _has_ retained its values for `factory` and `sensor`.
    ```
    Note that there's a lot of unwrapping here, but they're all safe because we know that integers will always format to exactly one chunk.
- With comptime formats:
    ```rust
    let mut formatter = temperatures::formatter();
    let ke = zenoh::keformat!(formatter, factory = 5, sensor = 42).unwrap();
    // Just like above, `formatter` can still be used after this.
    ```
    Not only is this shorter, but the compiler will also prevent you from misnaming fields. Note that fields are written to from left to right, and that the writing will short-circuit at first failure.  
    If you don't want the `.build()` implied by `keformat`, you can use `kewrite` instead with the exact same usage.

## Parsing
You can also use your formats to parse inbound KEs, like so:
- With runtime formats:
    ```rust
    let inbound = keyexpr::new("factory/temperature/sensor/-/5/42").unwrap();
    let parsed = temperatures.parse(inbound).unwrap();
    assert_eq!(parsed.get("factory"), Ok("5"));
    assert_eq!(parsed.get("sensor"), Ok("42"));
    ```
- With comptime formats:
    ```rust
    let inbound = keyexpr::new("factory/temperature/sensor/-/5/42").unwrap();
    let parsed = temperatures::parse(inbound).unwrap();
    assert_eq!(parsed.factory(), Ok("5"));
    assert_eq!(parsed.sensor(), Ok("42"));
    ```

Parsing is always lazy: spec-chunks with patterns containing `**` will always match as few chunks as they can before yielding to the rest of the format.
```rust
zenoh::kedefine!(example: "${prefix:**}/suffix/${suffix:**}");
fn test() {
    let inbound = keyexpr::new("some/prefix/suffix/some/suffix").unwrap();
    let parsed = example::parse().unwrap();
    assert_eq!(parsed.prefix(), Ok("some/prefix"));
    assert_eq!(parsed.suffix(), Ok("some/suffix"));
}
```
