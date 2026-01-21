---
title: "Migrating from Zenoh-Pico v0.5.x to Zenoh-Pico v0.6.x"
weight : 5600
menu:
  docs:
    parent: migration_0.5_to_0.6
---

## General considerations about the new Zenoh-Pico v0.6.x API

### Ownership model
The new Zenoh-Pico API, similarly to the Zenoh-C API, introduced a more explicit ownership model to the user. Such model targets a better memory management where e.g. memory leaks can be easily identified and double free can be avoided. The user will have a clear understanding on what is owned by his side of the code, and what has been loaned or moved to the API.

In a nutshell,
 1. For each Zenoh type in the API, there are in fact two types: an **owned** (e.g., `z_owned_*_t`) and a **loaned** (e.g., `z_*_t`) type. For example, `z_session_t` has an equivalent defined as `z_owned_session_t`. While the former is a borrowed/loaned object (meaning, the user does not need to release it), the latter is owned by the user and thus the user is responsible to release it.

 2. A set of ownership helpers, `z_move`, `z_loan`, `z_check` and `z_drop` are provided to ease the management of owned objects and defines how an object is passed to the API.
   - With `z_move`, the user give the ownership of an owned object to the API, meaning that the user no longer owns the object and therefore the user is no more responsible for releasing it.
   - With `z_loan`, the user retain the ownership of the owned object upon return of the API call. **Note that, releasing an object while loan references still exist causes undefined behavior.**
   - With `z_check`, the user can check if a owned object is valid, which also means that it retains memory to be released before going out of scope.
   - With `z_drop`, the user can release the memory associated to a given owned object. Although `z_drop` is double-free safe, loaned references to the object that might still live might cause undefined behavior.

### Private functions, types and constants
In the new Zenoh-Pico API, any private function, type or constant is prefixed with a `_z_*` or `_Z_*`. The user **must not use them**, since we will not guarantee their stability or even existence. Users might solely use any function, type or constant that starts with a `z_*` or `Z_*`
Also, any struct members denotated with a `_` are also private and **must not be used**. All the remaining members can be used, and we plan to keep them stable.

## Migrating from Zenoh-Pico v0.5.x zenoh-net API to Zenoh-Pico v0.6.x zenoh API

### Opening a session

All types and operations from the `zn_*` primitives have been updated and migrated to the `z_*` primitives.

*zenoh v0.5.x*
```C
zn_properties_t *config = zn_config_default();
zn_session_t *s = zn_open(config);
if (s == NULL) {
    printf("Unable to open session!\n");
    exit(-1);
}
```

*zenoh v0.6.x (C11)*
```C
z_owned_config_t config = z_config_default();
z_owned_session_t s = z_open(z_move(config));
if (!z_check(s)) {
    printf("Unable to open session!\n");
    exit(-1);
}
```

*zenoh v0.6.x (C99)*
```C
z_owned_config_t config = z_config_default();
z_owned_session_t s = z_open(z_config_move(&config));
if (!z_session_check(&s)) {
    printf("Unable to open session!\n");
    exit(-1);
}
```

### Subscribing

For this release, Zenoh-Pico only supports subscribers with callbacks. It is possible to access samples through a callback by calling the `callback` function passed as argument on `declare_subscriber` function.

When declaring a subscriber, keyexpr optimizations
(i.e., keyexpr declaration) will be automatically performed if required.

Finer configuration is performed with the help of an options struct.

*zenoh-net v0.5.x*
```C
void data_handler(const zn_sample_t *sample, const void *arg)
{
    printf(">> [Subscription listener] Received (%.*s, %.*s)\n",
           (int)sample->key.len, sample->key.val,
           (int)sample->value.len, sample->value.val);
}

// (...)

zn_subscriber_t *sub = zn_declare_subscriber(s, zn_rname("/key/expression"), zn_subinfo_default(), data_handler, NULL);
```

*zenoh v0.6.x (C11)*
```C
void data_handler(const z_sample_t *sample, void *arg)
{
    char *keystr = z_keyexpr_to_string(sample->keyexpr);
    printf(">> [Subscriber] Received ('%s': '%.*s')\n",
           keystr, (int)sample->payload.len, sample->payload.start);
    free(keystr);
}

// (...)

z_owned_closure_sample_t callback = z_closure(data_handler);
z_owned_subscriber_t sub = z_declare_subscriber(z_loan(s), z_keyexpr("key/expression"), z_move(callback), NULL);
if (!z_check(sub)) {
    printf("Unable to declare subscriber.\n");
    exit(-1);
}
```

*zenoh v0.6.x (C99)*
```C
void data_handler(const z_sample_t *sample, void *arg)
{
    char *keystr = z_keyexpr_to_string(sample->keyexpr);
    printf(">> [Subscriber] Received ('%s': '%.*s')\n",
           keystr, (int)sample->payload.len, sample->payload.start);
    free(keystr);
}

// (...)

z_owned_closure_sample_t callback = z_closure_sample(data_handler, NULL, NULL);
z_owned_subscriber_t sub = z_declare_subscriber(z_session_loan(&s), z_keyexpr("key/expression"), z_closure_sample_move(&callback), NULL);
if (!z_subscriber_check(&sub)) {
    printf("Unable to declare subscriber.\n");
    exit(-1);
}
```

### Publishing

The `write` operation has been replaced by a `put` operation.

When declaring a publisher, keyexpr optimizations (i.e., keyexpr declaration) will be automatically performed if required.

Finer configuration is performed with the help of an options struct.

*zenoh-net v0.5.x*
```C
zn_write(s, reskey, "value", strlen("value"));
```

*zenoh v0.6.x (C11)*
```C
if (z_put(z_loan(s), z_keyexpr("key/expression"), (const uint8_t *)"value", strlen("value"), NULL) < 0) {
    printf("Put has failed!\n");
}
```

*zenoh v0.6.x (C99)*
```C
if (z_put(z_session_loan(&s), z_keyexpr("key/expression"), (const uint8_t *)"value", strlen("value"), NULL) < 0) {
    printf("Put has failed!\n");
}
```

The `write_ext` operation has been removed. Configuration is now performed with the help of a option struct.

*zenoh-net v0.5.x*
```C
zn_write_ext(s, reskey, "value", strlen("value"), Z_ENCODING_TEXT_PLAIN, Z_DATA_KIND_DEFAULT, zn_congestion_control_t_BLOCK);
```

*zenoh v0.6.x (C11)*
```C
z_put_options_t options = z_put_options_default();
options.congestion_control = Z_CONGESTION_CONTROL_DROP;
options.encoding = z_encoding(Z_ENCODING_PREFIX_TEXT_PLAIN, NULL);
options.priority = Z_PRIORITY_DATA;
if (z_put(z_loan(s), z_keyexpr("key/expression"), (const uint8_t *)"value", strlen("value"), &options) < 0) {
    printf("Put has failed!\n");
}
```

*zenoh v0.6.x (C99)*
```C
z_put_options_t options = z_put_options_default();
options.congestion_control = Z_CONGESTION_CONTROL_DROP;
options.encoding = z_encoding(Z_ENCODING_PREFIX_TEXT_PLAIN, NULL);
options.priority = Z_PRIORITY_DATA;
if (z_put(z_session_loan(&s), z_keyexpr("key/expression"), (const uint8_t *)"value", strlen("value"), &options) < 0) {
    printf("Put has failed!\n");
}
```

The `declare_publisher` now returns a publisher object upon which `put` and `delete` operations can be performed.

*zenoh-net v0.5.x*
```C
zn_publisher_t *pub = zn_declare_publisher(s, reskey);
if (pub == NULL) {
    printf("Unable to declare publisher.\n");
    exit(-1);
}
```

*zenoh v0.6.x (C11)*
```C
z_owned_publisher_t pub = z_declare_publisher(z_loan(s), z_keyexpr("key/expression"), NULL);
if (!z_check(pub)) {
    printf("Unable to declare publisher!\n");
    exit(-1);
}
z_publisher_put(z_loan(pub), (const uint8_t *)"value", strlen("value"), NULL);
```

*zenoh v0.6.x (C99)*
```C
z_owned_publisher_t pub = z_declare_publisher(z_session_loan(&s), z_keyexpr("key/expression"), NULL);
if (!z_publisher_check(&pub)) {
    printf("Unable to declare publisher!\n");
    exit(-1);
}
z_publisher_put(z_publisher_loan(&pub), (const uint8_t *)"value", strlen("value"), NULL);
```

### Querying

The `query_collect` operation has been replaced by a `get` operation. The `get` operation is no longer blocking and returning a list of replies, but instead it makes replies accessible through a callback by calling the `callback` function passed as argument on `get` function.

When declaring a publisher, keyexpr optimizations (i.e., keyexpr declaration) will be automatically performed if required.

Finer configuration is performed with the help of an options struct.

*zenoh-net v0.5.x*
```C
zn_reply_data_array_t replies = zn_query_collect(s, zn_rname("/key/expression"), "", zn_query_target_default(), zn_query_consolidation_default());

for (unsigned int i = 0; i < replies.len; ++i) {
    printf(">> [Reply handler] received (%.*s, %.*s)\n",
            (int)replies.val[i].data.key.len, replies.val[i].data.key.val,
            (int)replies.val[i].data.value.len, replies.val[i].data.value.val);
}
zn_reply_data_array_free(replies);
```

*zenoh v0.6.x (C11)*
```C
void reply_dropper(void *ctx)
{
    printf(">> Received query final notification\n");
}

void reply_handler(z_owned_reply_t *oreply, void *ctx)
{
    if (z_reply_is_ok(oreply)) {
        z_sample_t sample = z_reply_ok(oreply);
        char *keystr = z_keyexpr_to_string(sample.keyexpr);
        printf(">> Received ('%s': '%.*s')\n", keystr, (int)sample.payload.len, sample.payload.start);
        free(keystr);
    } else {
        printf(">> Received an error\n");
    }
}

// (...)

z_get_options_t opts = z_get_options_default();
opts.target = Z_QUERY_TARGET_ALL;
z_owned_closure_reply_t callback = z_closure(reply_handler, reply_dropper);
if (z_get(z_loan(s), z_keyexpr("key/expression"), NULL, z_move(callback), &opts) < 0) {
    printf("Unable to send query.\n");
    exit(-1);
}
```

*zenoh v0.6.x (C99)*
```C
void reply_dropper(void *ctx)
{
    printf(">> Received query final notification\n");
}

void reply_handler(z_owned_reply_t *oreply, void *ctx)
{
    if (z_reply_is_ok(oreply)) {
        z_sample_t sample = z_reply_ok(oreply);
        char *keystr = z_keyexpr_to_string(sample.keyexpr);
        printf(">> Received ('%s': '%.*s')\n", keystr, (int)sample.payload.len, sample.payload.start);
        free(keystr);
    } else {
        printf(">> Received an error\n");
    }
}

// (...)

z_get_options_t opts = z_get_options_default();
opts.target = Z_QUERY_TARGET_ALL;
z_owned_closure_reply_t callback = z_closure_reply(reply_handler, reply_dropper, NULL);
if (z_get(z_session_loan(&s), z_keyexpr("key/expression"), "", z_closure_reply_move(&callback), &opts) < 0) {
    printf("Unable to send query.\n");
    exit(-1);
}
```

### Queryable

It is possible to access queries through a callback by calling the `callback` function passed as argument on `declare_queryable` function.

When declaring a queryable, keyexpr optimizations (i.e., keyexpr declaration) will be automatically performed if required.

Finer configuration is performed with the help of an options struct.

The `send_reply` operation has been also extended with an options struct for finer configuration.

*zenoh-net v0.5.x*
```C
void query_handler(zn_query_t *query, const void *ctx)
{
    z_string_t res = zn_query_res_name(query);
    z_string_t pred = zn_query_predicate(query);
    printf(">> [Query handler] Handling '%.*s?%.*s'\n", (int)res.len, res.val, (int)pred.len, pred.val);
    zn_send_reply(query, "/key/expression", "value", strlen("value"));
}

// (...)

zn_queryable_t *qable = zn_declare_queryable(s, zn_rname("/key/expression"), ZN_QUERYABLE_EVAL, query_handler, NULL);
if (qable == NULL) {
    printf("Unable to declare queryable.\n");
    exit(-1);
}
```

*zenoh v0.6.x (C11)*
```C
void query_handler(const z_query_t *query, void *ctx)
{
    char *keystr = z_keyexpr_to_string(z_query_keyexpr(query));
    z_bytes_t pred = z_query_parameters(query);
    printf(">> [Queryable ] Received Query '%s%.*s'\n", keystr, (int)pred.len, pred.start);
    z_query_reply(query, z_keyexpr("key/expression"), (const uint8_t *)"value", strlen("value"), NULL);
    free(keystr);
}

// (...)

z_owned_closure_query_t callback = z_closure(query_handler);
z_owned_queryable_t qable = z_declare_queryable(z_loan(s), z_keyexpr("key/expression"), z_move(callback), NULL);
if (!z_check(qable)) {
    printf("Unable to create queryable.\n");
    exit(-1);
}
```

*zenoh v0.6.x (C99)*
```C
void query_handler(const z_query_t *query, void *ctx)
{
    char *keystr = z_keyexpr_to_string(z_query_keyexpr(query));
    z_bytes_t pred = z_query_parameters(query);
    printf(">> [Queryable ] Received Query '%s%.*s'\n", keystr, (int)pred.len, pred.start);
    z_query_reply(query, z_keyexpr("key/expression"), (const uint8_t *)"value", strlen("value"), NULL);
    free(keystr);
}

// (...)

z_owned_closure_query_t callback = z_closure_query(query_handler, NULL, NULL);
z_owned_queryable_t qable = z_declare_queryable(z_session_loan(&s), z_keyexpr("key/expression"), z_closure_query_move(&callback), NULL);
if (!z_queryable_check(&qable)) {
    printf("Unable to create queryable.\n");
    exit(-1);
}
```


### Read and Lease tasks

As Zenoh-Pico is targeting microcontrollers and embedded systems, it is a requirement to support both single-thread and multi-thread implementations. To do so, the user has explicit control over the read and lease tasks.

If ### multi-thread behavior is intended, the user must spawn both tasks manually by including the following lines after Zenoh Session is successfully open.
*zenoh-net v0.5.x*
```C
zp_start_read_task(s);
zp_start_lease_task(s);
```

*zenoh v0.6.x (C11)*
```C
zp_start_read_task(z_loan(s), NULL);
zp_start_lease_task(z_loan(s), NULL);
```

*zenoh v0.6.x (C99)*
```C
zp_start_read_task(z_session_loan(&s), NULL);
zp_start_lease_task(z_session_loan(&s), NULL);
```


Likewise, the user must also destroy both tasks manually by including the following lines just before closing the session:
*zenoh-net v0.5.x*
```C
zp_stop_read_task(s);
zp_stop_lease_task(s);
```

*zenoh v0.6.x (C11)*
```C
zp_stop_read_task(z_loan(s));
zp_stop_lease_task(z_loan(s));
```

*zenoh v0.6.x (C99)*
```C
zp_stop_read_task(z_session_loan(&s));
zp_stop_lease_task(z_session_loan(&s));
```

Note that, ```z_close(z_move(s));``` will stop and destroy the tasks if the user forgets to do it. However, for the sake of symmetric operations, the user is advised to stop them manually.

If **single-thread behavior** is intended, the user must not spawn the any of the tasks. Instead, the user can a single execution of the read task and lease tasks at its own pace:

*zenoh v0.6.x (C11)*
```
zp_read(z_loan(s), NULL);
zp_send_keep_alive(z_loan(s), NULL);
zp_send_join(z_loan(s), NULL);
```

*zenoh v0.6.x (C99)*
```
zp_read(z_session_loan(&s), NULL);
zp_send_keep_alive(z_session_loan(&s), NULL);
zp_send_join(z_session_loan(&s), NULL);
```

### Examples

More examples are available here: 

[*zenoh v0.6.0 (C11)*](https://github.com/eclipse-zenoh/zenoh-pico/tree/0.6.0-beta.1/examples/unix/c11)

[*zenoh v0.6.0 (C99)*](https://github.com/eclipse-zenoh/zenoh-pico/tree/0.6.0-beta.1/examples/unix/c99)

[*zenoh-net v0.5.0-beta9*](https://github.com/eclipse-zenoh/zenoh-pico/tree/0.5.0-beta.9)
