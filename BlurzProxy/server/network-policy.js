const dns = require("node:dns").promises;
const ipaddr = require("ipaddr.js");

/**
 * Only allow hostnames whose complete DNS answer set is globally routable.
 * Wisp accepts one resolved address and connects to that same address. Rejecting
 * the entire answer set prevents a mixed public/private response from passing
 * merely because its first record happened to be public.
 */
function isPublicUnicastAddress(address) {
  if (typeof address !== "string" || !ipaddr.isValid(address)) return false;

  let parsed = ipaddr.parse(address);
  if (parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()) {
    parsed = parsed.toIPv4Address();
  }

  return parsed.range() === "unicast";
}

function createPublicDnsResolver({ lookup = dns.lookup } = {}) {
  if (typeof lookup !== "function") {
    throw new TypeError("A DNS lookup function is required.");
  }

  return async function resolvePublicHostname(hostname) {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error("Destination hostname did not resolve to an address.");
    }

    // Fail closed if ANY answer is non-public, including IPv4-mapped IPv6,
    // loopback, private, link-local, reserved, multicast, or unspecified ranges.
    for (const record of records) {
      if (!record || !isPublicUnicastAddress(record.address)) {
        throw new Error("Destination hostname resolved to a non-public address.");
      }
    }

    // Wisp caches this value and passes it unchanged to the socket connection.
    return records[0].address;
  };
}

function configureWispNetworkPolicy(wisp, { lookup } = {}) {
  if (!wisp || !wisp.options) throw new TypeError("A Wisp server instance is required.");

  Object.assign(wisp.options, {
    allow_private_ips: false,
    allow_loopback_ips: false,
    allow_direct_ip: false,
    allow_udp_streams: false,
    allow_tcp_streams: true,
    port_whitelist: [80, 443],
    stream_limit_per_host: 16,
    stream_limit_total: 64,
    // Wisp caches only the already-validated IP returned by dns_method.
    dns_ttl: 30,
    dns_cache_size: 1024,
    // Validate every DNS answer before Wisp opens a socket to the selected IP.
    dns_method: createPublicDnsResolver(lookup ? { lookup } : {}),
    dns_result_order: "verbatim",
    // Do not trust client-supplied forwarding headers for connection identity.
    parse_real_ip: false,
    parse_real_ip_from: [],
    hostname_blacklist: [
      /(^|\\.)localhost$/i,
      /(^|\\.)local$/i,
      /(^|\\.)internal$/i,
      /(^|\\.)localhost\\.localdomain$/i,
      /^metadata(?:\\.|$)/i,
      /^metadata\\.google\\.internal$/i,
      /^instance-data(?:\\.|$)/i
    ]
  });

  return wisp.options;
}

module.exports = {
  configureWispNetworkPolicy,
  createPublicDnsResolver,
  isPublicUnicastAddress
};
