const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  configureWispNetworkPolicy,
  createPublicDnsResolver,
  isPublicUnicastAddress
} = require("../server/network-policy");

test("public resolver accepts globally routable IPv4 and IPv6", async () => {
  const resolve = createPublicDnsResolver({
    lookup: async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 }
    ]
  });

  assert.equal(await resolve("public.example"), "93.184.216.34");
});

test("public resolver rejects mixed public and private DNS answers in either order", async () => {
  for (const records of [
    [{ address: "93.184.216.34" }, { address: "10.0.0.8" }],
    [{ address: "10.0.0.8" }, { address: "93.184.216.34" }]
  ]) {
    const resolve = createPublicDnsResolver({ lookup: async () => records });
    await assert.rejects(resolve("mixed.example"), /non-public address/);
  }
});

test("public resolver rejects loopback, link-local, private, reserved, multicast and mapped addresses", async () => {
  const blocked = [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "2002:7f00:1::",
    "2001:0000::1"
  ];

  for (const address of blocked) {
    assert.equal(isPublicUnicastAddress(address), false, address);
    const resolve = createPublicDnsResolver({
      lookup: async () => [{ address }]
    });
    await assert.rejects(resolve("blocked.example"), /non-public address/);
  }
});

test("public resolver rejects invalid addresses, empty answers and resolver failures", async () => {
  assert.equal(isPublicUnicastAddress("not-an-ip"), false);

  const empty = createPublicDnsResolver({ lookup: async () => [] });
  await assert.rejects(empty("empty.example"), /did not resolve/);

  const failed = createPublicDnsResolver({
    lookup: async () => { throw new Error("simulated DNS failure"); }
  });
  await assert.rejects(failed("failure.example"), /simulated DNS failure/);
});

test("Wisp policy installs fail-closed all-answer DNS validation and strict transport limits", async () => {
  let lookupOptions;
  const wisp = { options: {} };
  const options = configureWispNetworkPolicy(wisp, {
    lookup: async (_hostname, suppliedOptions) => {
      lookupOptions = suppliedOptions;
      return [{ address: "93.184.216.34", family: 4 }];
    }
  });

  assert.equal(options.allow_private_ips, false);
  assert.equal(options.allow_loopback_ips, false);
  assert.equal(options.allow_direct_ip, false);
  assert.equal(options.allow_udp_streams, false);
  assert.equal(options.allow_tcp_streams, true);
  assert.deepEqual(options.port_whitelist, [80, 443]);
  assert.equal(options.stream_limit_per_host, 16);
  assert.equal(options.stream_limit_total, 64);
  assert.equal(options.dns_ttl, 30);
  assert.equal(options.dns_cache_size, 1024);
  assert.equal(options.parse_real_ip, false);
  assert.deepEqual(options.parse_real_ip_from, []);
  assert.equal(await options.dns_method("safe.example"), "93.184.216.34");
  assert.deepEqual(lookupOptions, { all: true, verbatim: true });
  assert.ok(options.hostname_blacklist.some((pattern) => pattern.test("localhost")));
  assert.ok(options.hostname_blacklist.some((pattern) => pattern.test("metadata.google.internal")));
  assert.ok(options.hostname_blacklist.some((pattern) => pattern.test("service.internal")));
});
