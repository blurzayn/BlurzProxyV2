import EpoxyTransport from "/vendor/epoxy/index.mjs";

function toHeaders(headers) {
  if (headers instanceof Headers) {
    return headers;
  }

  const entries = Object.entries(headers || {}).map(([name, value]) => [
    name,
    Array.isArray(value)
      ? value.join(name.toLowerCase() === "cookie" ? "; " : ", ")
      : String(value)
  ]);

  return new Headers(entries);
}

function toHeaderRecord(headers) {
  if (!Array.isArray(headers)) {
    return headers;
  }

  return headers.reduce((record, [name, value]) => {
    const key = name.toLowerCase();
    if (key in record) {
      record[key] = Array.isArray(record[key])
        ? [...record[key], value]
        : [record[key], value];
    } else {
      record[key] = value;
    }
    return record;
  }, {});
}

export default class BlurzEpoxyTransport extends EpoxyTransport {
  async request(remote, method, body, headers, signal) {
    const response = await super.request(
      remote,
      method,
      body,
      toHeaders(headers),
      signal
    );

    return {
      ...response,
      headers: toHeaderRecord(response.headers)
    };
  }

  connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
    return super.connect(
      url,
      protocols,
      toHeaders(requestHeaders),
      onopen,
      onmessage,
      onclose,
      onerror
    );
  }
}
