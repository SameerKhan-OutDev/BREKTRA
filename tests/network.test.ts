import { test } from "node:test";
import assert from "node:assert/strict";
import type { NetworkInterfaceInfo } from "node:os";
import { lanInterfaces, lanPeer, loopbackPeer, invitationOrigins } from "../server/network.ts";

test("LAN access accepts only private attached networks and never trusts forwarded peers", () => {
  const item = (address: string, netmask = "255.255.255.0", internal = false): NetworkInterfaceInfo =>
    ({ address, netmask, internal, family: "IPv4", cidr: `${address}/24`, mac: "00:00:00:00:00:00" });
  const interfaces = lanInterfaces({ wifi: [item("192.168.100.166")], public: [item("8.8.8.8")],
    local: [item("127.0.0.1", "255.0.0.0", true)], link: [item("169.254.1.1")] });
  assert.deepEqual(interfaces.map(i => i.address), ["192.168.100.166"]);
  assert.equal(lanPeer("192.168.100.20", interfaces), true);
  assert.equal(lanPeer("::ffff:192.168.100.20", interfaces), true);
  for (const peer of ["192.168.101.20", "10.0.0.1", "8.8.8.8", "localhost", "", "192.168.100.999", "::1"])
    assert.equal(lanPeer(peer, interfaces), false, peer);
  assert.equal(lanPeer("10.20.1.2", [item("10.20.0.1", "255.255.0.0")]), true);
  assert.equal(lanPeer("172.31.2.5", [item("172.31.2.1")]), true);
  assert.equal(loopbackPeer("::ffff:127.0.0.1"), true);
  assert.equal(loopbackPeer("192.168.100.166"), false);
  assert.deepEqual(lanInterfaces({virtual:[{...item("192.168.56.1"),mac:"0a:00:27:00:00:01"}],
    wifi:[{...item("192.168.100.166"),mac:"90:09:df:00:00:01"}]}).map(i => i.address), ["192.168.100.166", "192.168.56.1"]);
});


test("LAN invitations replace loopback, preserve the selected interface, and never trust an unlisted host", () => {
  const urls = ["http://192.168.1.50:4310", "http://10.0.0.5:4310"];
  const network = {lan:true, urls};
  assert.deepEqual(invitationOrigins(false, "http://127.0.0.1:4310", "localhost:4310", network), urls);
  assert.deepEqual(invitationOrigins(false, "http://127.0.0.1:4310", "10.0.0.5:4310", network), [urls[1], urls[0]]);
  assert.deepEqual(invitationOrigins(false, "http://127.0.0.1:4310", "attacker.example:4310", network), urls);
  assert.throws(() => invitationOrigins(false, "http://127.0.0.1:4310", "localhost:4310", {lan:true,urls:[]}), /No LAN address/);
  assert.deepEqual(invitationOrigins(true, "https://workspace.example", "localhost:4310", network), ["https://workspace.example"]);
  assert.deepEqual(invitationOrigins(false, "http://127.0.0.1:4310", "127.0.0.1:4310", {lan:false,urls:[]}), ["http://127.0.0.1:4310"]);
});
