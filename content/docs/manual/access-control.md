---
title: "Access Control"
weight : 3900
menu:
  docs:
    parent: manual
---

*NOTE: This documentation covers the Zenoh 1.0 ACL config. For Zenoh 0.11 ACL config,
please refer to the [Zenoh 0.11 Access Control Rules RFC](https://github.com/eclipse-zenoh/roadmap/blob/ca841fe219890bf73289089b520271d70ded89b6/rfcs/ALL/Access%20Control%20Rules.md)*

*Access control* enables Zenoh instances to filter (allow or deny) messages,
depending on certain characteristics of individual messages and their respective source or destination.
*Authentication* on the other hand allows Zenoh instances to identify certain characteristics in other instances they connect to,
which are used to match the remote instances with configured subjects in the ACL policies and apply the rules accordingly on the exchanged messages.

The configuration of access control policies is done via a [configuration file](../configuration).

---------
## ACL configuration

ACL configuration mainly consists of three components: `rules`, `subjects` and `policies`, to which is added the `default_permission` (`allow` or `deny`) to be applied on messages that do not match the configured policies.

The `enabled` boolean field allows to enable and disable ACL. Note that ACL config cannot be updated at runtime, and requires a restart of the instance to reflect the changes.

Below is the example config we will be analyzing in this documentation.

```json
{
  "access_control": {
    "enabled": true,
    "default_permission": "allow",
  
    "rules": [
      {
        "id": "deny pub/sub",
        "permission": "deny",
        "flows": ["ingress", "egress"],
        "messages": [
          "declare_subscriber",
          "put",
          "delete",
        ],
        "key_exprs": [
          "demo/example/**",
        ],
      }
    ],
  
    "subjects": [
      {
        "id": "example subject",
        "interfaces": [
          "lo0",
          "en0",
        ],
        "cert_common_names": [
          "example.zenoh.io"
        ],
        "usernames": [
          "zenoh-example1",
          "zenoh-example2",
        ],
      }
    ],
  
    "policies": [
      {
        "rules": [
          "deny pub/sub"
        ],
        "subjects": [
          "example subject"
        ],
      },
    ]
  }
}
```

### rules

Each rule within the `rules` list is identified by a unique `id` string. Rules apply on matched messages based on their individual characteristics:

- `messages`: types of messages to apply the rule on. Supported message types are the following:
  - Pub/Sub messages:
    - Declare Subscriber (`declare_subscriber`)
    - Publication (`put`)
    - Delete (`delete`)
  - Queryable messages:
    - Declare Queryable (`declare_queryable`)
    - Query (`query`)
    - Reply (`reply`)
  - Liveliness messages (as of Zenoh v1.0.3):
    - Liveliness Token (`liveliness_token`)
    - Declare Liveliness Subscriber (`declare_liveliness_subscriber`)
    - Liveliness Query (`liveliness_query`): note that its associated replies are **Liveliness Token** messages.
- `flows`: applies rule on incoming messages (`ingress`), outgoing messages (`egress`), or both directions. If this field is not provided in the config, the rule will apply to both directions by default.
- `key_exprs`: the rule applies on messages for which the key matches one of the given key expressions. For more details on key expression matching, see [Key Expressions](https://zenoh.io/docs/manual/abstractions/#key-expression).

Matched messages are filtered based on the rule's `permission`: `allow` or `deny`.

For instance, the following rule denies all incoming and outgoing subscriptions, publications and deletions on key expressions matching `demo/example/**`:

```json
{
  "id": "deny pub/sub",
  "permission": "deny",
  "flows": ["ingress", "egress"],
  "messages": [
    "declare_subscriber",
    "put",
    "delete",
  ],
  "key_exprs": [
    "demo/example/**",
  ],
}
```

### subjects

Each subject configuration is identified by a unique `id` string. Subject configuration combines `interfaces`, `cert_common_names` and `usernames` to match with configurations of connecting Zenoh instances.

- `interfaces`: list of local network interfaces through which the configured instance communicates with the remote instance to be matched.
- `cert_common_names`: list of certificate common names which are matched with the respective certificate content of the remote instance using TLS or QUIC transport. For details on certificate configuration refer to [TLS authentication](../tls) and [QUIC transport](../quic).
- `usernames`: list of usernames to be matched with the authentication config of remote instances. Refer to [User-Password authentication](../user-password) for how to setup this authentication mechanism.

To produce all possible combinations that characterize a subject configuration, the Cartesian product of the `interfaces`, `cert_common_names` and `usernames` lists is calculated. This allows for items within the same list to be considered a logical `OR`, and items across different lists to be considered a logical `AND`.
To demonstrate these logical combinations, below is an example of a subject configuration and its internal representation.

```json
{
  "id": "example subject",
  "interfaces": [
    "lo0",
    "en0",
  ],
  "cert_common_names": [
    "example.zenoh.io"
  ],
  "usernames": [
    "zenoh-example1",
    "zenoh-example2",
  ],
  // This instance translates internally to this filter:
  // (interface="lo0" AND cert_common_name="example.zenoh.io" AND username="zenoh-example1") OR
  // (interface="lo0" AND cert_common_name="example.zenoh.io" AND username="zenoh-example2") OR
  // (interface="en0" AND cert_common_name="example.zenoh.io" AND username="zenoh-example1") OR
  // (interface="en0" AND cert_common_name="example.zenoh.io" AND username="zenoh-example2")
}
```

Note that any of the three lists presented above can be omitted, and will be interpreted as a wildcard (i.e matches with all possible values of that authentication method). This implies that the empty subject below is a wildcard that will match any Zenoh instance.

```json
{
  "id": "subject that matches all zenoh instances",
}
```

### policies

The `policies` list associates configured rules to configured subjects based on their unique `id`s. For example, the policy below applies the `deny pub/sub` rule on the `example subject` subject declared above. Note that in a policy object, `rules` and `subjects` are lists, which conveniently allows to apply multiple rules to multiple subjects within the same policy object.

```json
{
  "rules": [
    "deny pub/sub"
  ],
  "subjects": [
    "example subject"
  ],
}
```

---------

## Guidelines for configuring ACL

Designing ACL policies can be quite the challenge, especially when considering the potential impact that a subomptimal configuration can have on performance.
For you convenience, we've compiled below some guidelines and common mistakes to look out for when configuring ACL.

- The first step to consider is which of the two ACL models to use: set `"default_permission": "deny"` and define `allow` rules, or the opposite.
This choice can have an impact on performance if the number of rules to verify per message is too high.
Therefore, it is considered best practice in most cases to pick the model that yields the least amount of rules, with regards to your application and desired filters.
- When defining subjects and applying rules on them, avoid having two different subjects that can match the same instance and have the same rule apply on them, as this could lead to a double verification of said rule in this case, which yields a loss in performance.
- Defining rules that apply on both `ingress` and `egress` flows can cause a double verification of messages, which leads to performance loss.
Avoid defining rules that respectively apply on both flows, unless the affected messages are *generated* or *consumed* by the instance, and do not pass through it. Consider the following examples:
  - A router receives `put` messages and routes them, which applies both of its matching `ingress` and `egress` rules on them.
  - A client running a subscriber receives and *consumes* `put` messages, only applying its matching `ingress` rules on them.
  - A client publisher *generates* `put` messages and so only applies its matching `egress` rules on them.
  - A client running both a publisher and a subscriber *generates* and *consumes* `put` messages,
  but only applies either of its matching `ingress` or `egress` rules on each individual message.
- Depending on your rules, conflicting decisions on the same message can occur (`allow` and `deny` from different rules).
In this case, it is important to know decision priority to predict the outcome: **explicit deny rule** > **explicit allow rule** > **default_permission rule**.
For more details on decision priority, please refer to the [*Priority* section of the Access Control Rules RFC](https://github.com/eclipse-zenoh/roadmap/blob/main/rfcs/ALL/Access%20Control%20Rules.md#priority).
- Key expression matching when applying rules on messages can have a substantial impact on performance, depending on how the rules are constructed.
When possible, avoid using wildcards and DSL (eg: `"**"`, `"example/*"`, `"example/t$*"`) and prefer keys (eg: `example/test`) which are much faster to match.
- Look out for supersets and partial overlap between rule key expressions and message key, which are not considered valid matches and therefore will not apply said ACL rule on said message.
For more details on this regard, please refer to the [*Key-Expression Matching* section of the Access Control Rules RFC](https://github.com/eclipse-zenoh/roadmap/blob/main/rfcs/ALL/Access%20Control%20Rules.md#key-expression-matching).
- When filtering queryable messages, keep in mind that a `reply` does not necessarily have the same key expression as its associated `query`.
- As mentioned in message types above, a `liveliness_query` message will have `liveliness_token` messages as its associated replies, therefore it is important to set the rules applying to `liveliness_token` accordingly.
- Bare in mind that the effectiveness of ACL policies is highly dependent of your Zenoh network topology and how much control you have over it. The topology can evolve in unpredictable ways in certain scenarios when combined with configuration options like `scouting` and `gossip`, which is complicated further when factoring the mobility of Zenoh clients in certain use-cases.

---------

For a more technical analysis of the ACL feature, please refer to the [Access Control Rules RFC](https://github.com/eclipse-zenoh/roadmap/blob/main/rfcs/ALL/Access%20Control%20Rules.md).
