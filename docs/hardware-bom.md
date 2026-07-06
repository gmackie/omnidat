# Hardware BOM

This is the working hardware inventory for running OMNIDAT as an event
installation. It is organized by subsystem and split into:

- **Minimum**: enough to prove the service locally.
- **Event target**: what should be staged for ToorCamp.
- **Stretch**: useful if budget, volunteers, and transport capacity allow it.

The first practical target is one ShadyTel PRI, one OMNIDAT PBX, 4-8 dial-up
data ports, 2-4 PAD/terminal ports, fax, dot matrix print, a visible Media Vault
prototype, analog OMNIDAT TV, and a local IP stream.

For earlier camps and portable demos (including potential CC Camp 2027 rehearsals), the Field Office kit can run a smaller
Packet Clearing service with hosted campsite apps, Radio PAD access, passport
logging, and printed receipts before the full Exchange 88 buildout exists.

See README.md "Planned Camp Deployments" for ToorCamp 2028 flagship and CC Camp 2027 potential usage. H5-H8 plan details the rehearsal-to-buildout checklist.

## 1. Rack, Power, and Physical Plant

### Minimum

- 1 small rack or rolling AV/network cart.
- 1 UPS for PBX, gateways, switch, and core servers.
- 1 switched or metered PDU.
- 1 unmanaged or managed gigabit switch.
- Cable labels, Velcro, spare IEC cords, and power strips.

### Event Target

- 1 12U-24U rack or road case.
- 2 UPS units: one for telecom/network, one for media/robot control.
- 2 rack PDUs.
- Rack shelves for gateways, modems, VCRs, and odd hardware.
- 1 copper patch panel for Ethernet.
- 1 RJ11/RJ14/RJ25 voice patch panel or 66/110 block field.
- 1 serial patch panel if using many terminals/modems.
- Grounding bar and clearly marked service disconnects.
- Printed cable map taped inside the rack.

### Stretch

- Separate "central office" rack and "media vault" rack.
- Environmental sensors for temperature and smoke.
- Out-of-band management network.
- Battery runtime display visible to operators.

## 2. ShadyTel PRI Handoff

### Minimum

- ShadyTel-provided ISDN PRI T1 handoff.
- RJ48 cable from ShadyTel demarc to OMNIDAT equipment.
- PRI endpoint: either a PRI-to-SIP gateway or native PRI card.

### Event Target

- 1 primary PRI-to-SIP gateway.
- 1 spare PRI-to-SIP gateway or spare PRI card.
- RJ48 loopback plug.
- Spare RJ48 cables.
- Printed PRI settings sheet:
  - framing and line coding
  - switch type
  - clocking
  - called-number digit delivery
  - channel count

### Representative Options

- Sangoma Vega 100G or similar 1-port T1/E1/PRI gateway.
- Patton SmartNode 4170-class SIP-to-PRI gateway.
- Asterisk/FreeSWITCH server with single-span T1/E1/PRI PCIe card.

Recommendation: use a PRI-to-SIP gateway for V1 unless there is a strong reason
to terminate PRI directly in the PBX server. It makes the physical T1 problem
smaller and keeps the PBX easier to test without the trunk attached.

## 3. PBX and Voice Core

### Minimum

- 1 small server or mini PC for Asterisk/FreeSWITCH.
- 2 Ethernet interfaces or VLAN-capable single interface.
- Local SSD storage.
- Console keyboard/display or reliable remote console.

### Event Target

- 1 primary PBX server.
- 1 cold spare PBX server imaged before the event.
- Managed switch with voice/data VLANs.
- NTP source, local DNS/DHCP, and static addressing plan.
- Backup config stored offline and printed in abbreviated form.

### Stretch

- HA pair with warm standby.
- Dedicated SBC/SIP edge if OMNIDAT peers beyond ShadyTel.
- Prometheus/Grafana or similar status wall.

## 4. Analog Voice, Modems, and Fax Ports

### Minimum

- 1 FXS gateway with at least 4 analog station ports.
- 2 external modems.
- 1 physical fax machine.
- 1 analog handset for operator/test calls.

### Event Target

- 1 FXS gateway with 16 or more ports.
- 6-8 external serial modems for BBS, file drop, shell, and direct lines.
- 1 physical fax machine.
- 1 fax server path, either fax modem or SIP/T.38 path.
- 2-4 analog desk phones for operators and demos.
- RJ11 patch field and spare line cords.

### Stretch

- 24-48 FXS ports for larger modem/phone/fax pools.
- Separate FXO gateway if OMNIDAT must consume analog lines from a vintage PBX.
- Analog butt set for line testing.
- Caller-ID test set.

### Notes

For real modem behavior, budget actual analog endpoints. Each simultaneous modem
session consumes:

```text
1 PRI B-channel
1 PBX route
1 FXS port
1 modem
1 serial port or host-side modem interface
```

Modems over SIP can work on a clean local G.711 LAN, but they are less forgiving
than ordinary voice. Keep transcoding, jitter buffers, packet loss, and echo
cancellation under tight control.

## 5. BBS and Dial-Up Hosts

### Minimum

- 1 BBS host.
- 1-2 external serial modems.
- 1 USB-to-serial adapter per modem if the host lacks real serial ports.
- 1 backup image of the BBS host.

### Event Target

- 1 primary BBS/file/shell host.
- 1 secondary host for experiments or fallback.
- 6-8 serial modems.
- Industrial USB serial hub or multi-port serial card.
- Serial cables, null-modem adapters, gender changers, and spare power bricks.
- Local storage for logs and file drops.

### Stretch

- Separate UUCP/store-and-forward host.
- Public terminal near the operator desk.
- Read-only archive mirror for demos.

## 6. Packet Clearing and Terminal Network

### Minimum

- 1 Packet Clearing host.
- 1-2 serial terminals or terminal emulators.
- 1 small terminal server or USB serial adapter set.

### Event Target

- 1 Packet Clearing host.
- 1 spare host or VM image.
- 4-8 physical terminals or terminal stations.
- 1 terminal server with 8-16 serial ports.
- RS-232 cabling kit:
  - DB25 and DB9 cables
  - null-modem adapters
  - gender changers
  - breakout tester
  - spare USB serial adapters
- Optional sync-serial/X.25 routers if running real packet hardware.

### Stretch

- Real X.25-capable routers with synchronous serial interfaces.
- XOT tunnel routers.
- Vintage PAD hardware.
- V.35/RS-449/X.21 cable kit, depending on router interfaces.
- Separate "branch office" terminal station reachable over packet links.

### Implementation Tiers

```text
Tier 1  Terminal-faithful PAD emulation on modern hosts
Tier 2  XOT or IP-backed X.25 between routers/hosts
Tier 3  Real X.25 over synchronous serial hardware
```

Tier 1 is enough to run the event experience. Tier 2/3 are authenticity upgrades.

## 6A. Field Office, Radio PAD, and Campsite App Kit

### Laptop Field Office Minimum

- 1 laptop or mini PC running Packet Clearing, signup/admin tools, and event
  logs.
- 1 Wi-Fi AP/router.
- 1 USB receipt printer or shared dot matrix printer path.
- 1 USB serial adapter and terminal, optional.
- 2-4 MeshCore loaner radios.
- 1 Meshtastic gateway radio, optional.
- Paper passport cards, service-order forms, and address assignment sheets.
- Label maker, spare USB power, and printed quick-start cards.

### Portable Campsite Exchange

- 1 fanless mini PC or Raspberry Pi-class host.
- 1 campsite Wi-Fi AP.
- 1 serial terminal or rugged laptop running a terminal emulator.
- 1 small receipt printer or routed OMNIDAT print queue.
- 1 MeshCore companion or relay radio.
- 1 Meshtastic node for guest/BYO bridge, optional.
- 1 analog phone/modem if ShadyTel/POTS is available.
- Laminated packet address card and demarc label.

### OMNIDAT Village Field Office Target

- 1 primary service mini PC.
- 1 cold spare service mini PC or imaged SSD.
- 1 managed switch.
- 1 Wi-Fi AP/router.
- 1 Packet Clearing terminal station.
- 1 operator laptop.
- 1 dot matrix printer with paper and ribbons.
- 1 label printer.
- 4-8 MeshCore loaner radios.
- 2 fixed MeshCore repeater/room-server nodes.
- 1 Meshtastic gateway node.
- Optional FXS gateway plus 1-2 modems for POTS/ShadyTel testing.
- UPS or battery for service host, AP, and radio gateway.
- Binder with service orders, address assignments, passport forms, and runbook.

### Supported Portable Services

- Open campsite namespace.
- Hosted campsite apps.
- Radio PAD gateway.
- Activity passport and merit-badge clearing.
- Miliways-style queue/order sample app.
- Print receipts and campsite provisioning artifacts.
- Operator approval and directory status updates.

See [Field Office X.25 App Platform Plan](plans/2026-06-29-omnidat-field-office-x25-app-platform.md).

## 7. Document Services

### Minimum

- 1 physical fax machine.
- 1 dot matrix printer.
- Printer interface:
  - parallel print server, serial print server, or USB adapter
- Continuous-feed paper.
- Spare ribbon.

### Event Target

- 1 physical fax machine on `8818`.
- 1 fax server/capture path.
- 1 dot matrix printer for public/operator artifacts.
- 1 spare dot matrix printer or tested replacement print head/ribbon stock.
- 3+ ribbon cartridges.
- 2+ boxes continuous-feed paper.
- 1 paper cutter or tear bar.
- Operator workstation for print/fax queues.

### Stretch

- Second printer for logs vs public receipts.
- Flatbed scanner for received forms.
- Preprinted OMNIDAT forms.
- Rubber stamps: RECEIVED, CLEARED, HOLD, VOID.

## 8. Media Vault Robot

### Minimum

- 3-5 slot benchtop VHS shelf prototype.
- 1 VCR.
- 1 CRT or monitor.
- 1 robot controller.
- 1 stepper axis.
- 1 pusher/gripper actuator.
- Home/end limit switches.
- Emergency stop.

### Event Target

- 12-24 VHS slots.
- Rigid frame: aluminum extrusion, plywood cabinet, or rack-like structure.
- Linear motion:
  - X-axis rail
  - belt, lead screw, or rack drive
  - stepper motor and driver
- Tape handling:
  - gripper or sled
  - short-stroke pusher/puller
  - tape-present sensor
  - VCR-loaded/ejected sensor
- Control:
  - microcontroller for motion
  - host service for queue/inventory
  - relay or GPIO interface for interlocks
  - physical emergency stop
- Video:
  - 1 primary VCR
  - 1 spare VCR
  - composite/S-video cabling
  - TBC/frame sync or stabilizer
  - robot camera
  - operator monitor

### Stretch

- Barcode, QR, or RFID tape identity check.
- Second VCR for preview or faster changeover.
- Enclosed cabinet with clear front.
- Door interlock.
- Load-cell or current-sense jam detection.
- Motorized VCR button actuators if electronic control is unavailable.

## 9. OMNIDAT TV and Local IP Stream

### Minimum

- VCR video output.
- Composite display or CRT.
- USB/composite capture device.
- Local encoder host.

### Event Target

- TBC/frame sync for VHS stability.
- Video switcher or matrix.
- Title/slate/overlay generator.
- Composite to HDMI or SDI conversion as needed.
- Analog RF modulator for closed-circuit OMNIDAT TV.
- Coax distribution amplifier.
- Splitters, terminators, and coax drops.
- 2-4 CRTs or venue displays.
- Capture/encoder host for local IP stream.
- Recording disk.

### Stretch

- Multi-channel closed-circuit headend.
- Dedicated preview/program monitors.
- Character generator with live data from PBX/Media Vault.
- Camera on fax/printer desk.

## 10. Amateur Television Station Path

### Minimum

- Licensed control operator.
- Separate station-control switch so ATV/DATV can be disconnected from OMNIDAT
  TV immediately.
- Callsign/station ID overlay path.
- Dummy load for bench testing.

### Event Target

- ATV or DATV modulator/transmitter chain selected by the licensed operator.
- Appropriate bandpass/low-pass filtering.
- Power/SWR meter.
- Antenna, mast, coax, and grounding.
- Station log.
- RF safety plan.
- Clearly marked shutdown authority.

### Stretch

- Both analog ATV and DATV modes.
- Signal-report phone line or Packet Clearing form.
- Spectrum monitoring receiver.
- Portable receive kits for nearby villages.

## 11. Operator Desk

### Minimum

- 1 operator laptop/workstation.
- 1 analog or SIP phone.
- Printed dial plan.
- Incident log notebook.

### Event Target

- 2 operator stations.
- Headsets or handsets.
- Status display for:
  - PRI channels
  - active calls
  - modem/PAD availability
  - fax/print queue
  - Media Vault state
  - TV/stream state
- Label printer or preprinted labels.
- Dot matrix printer access.
- Binder with:
  - startup checklist
  - shutdown checklist
  - ShadyTel contact path
  - PRI settings
  - service map
  - emergency stop procedure

### Stretch

- Wall-mounted status board.
- Physical line lamps or busy board.
- Operator key panel.

## 12. Network and Server Infrastructure

### Minimum

- 1 managed switch.
- 1 router/firewall.
- 1 local server for PBX or services.
- Local backups.

### Event Target

- Managed switch with VLAN support.
- Router/firewall.
- Local DNS/DHCP.
- NTP.
- NAS or external SSD for backups, logs, and media recordings.
- Monitoring host.
- Separate VLANs:
  - voice
  - services
  - operator
  - media
  - guest/viewer stream
  - management

### Stretch

- Out-of-band console server.
- LTE/Starlink/non-event fallback only for management, if allowed.
- Spare switch and router with exported configs.

## 13. Test, Tools, and Spares

Required field kit:

- Label maker and labels.
- RJ45/RJ48/RJ11 crimper and ends.
- Punchdown tool.
- Tone generator and probe.
- Cable tester.
- Multimeter.
- USB serial adapters.
- Serial breakout tester.
- Null-modem and gender adapters.
- Spare Ethernet, RJ11, RJ48, coax, serial, IEC, and USB cables.
- Spare SD cards/SSDs with known-good images.
- Spare modem power supplies.
- Spare stepper driver and motor.
- Spare limit switches.
- Spare VCR remote and batteries.
- Printed network maps and dial plan.

Useful but optional:

- T1/PRI test set.
- Oscilloscope or logic analyzer for robot/sensor debugging.
- SDR or spectrum receiver for ATV verification.
- Thermal printer for labels/receipts if dot matrix fails.

## 14. Suggested First Purchase/Build Order

### Portable Field Office

1. Mini PC or laptop for Packet Clearing and admin tools.
2. Wi-Fi AP/router.
3. Dot matrix, receipt, or label printer path.
4. 2-4 MeshCore loaner radios.
5. 1 Meshtastic gateway node.
6. USB serial adapter and one terminal station.
7. UPS or battery for host/AP/radio gateway.
8. Paper forms, passport cards, labels, and binder.

This order lets OMNIDAT prove the camp app platform and Radio PAD before buying
heavier telecom hardware.

### Full Exchange 88 Buildout

1. PBX server.
2. FXS gateway with at least 16 ports.
3. 2-4 external serial modems.
4. Dot matrix printer and print server path.
5. Physical fax machine.
6. Terminal server and 2 terminals.
7. BBS/Packet Clearing host.
8. VCR, CRT, capture device, and TBC/frame sync.
9. 3-5 slot Media Vault motion prototype.
10. PRI-to-SIP gateway or PRI card after ShadyTel confirms handoff details.

This order lets OMNIDAT run locally before the PRI exists. The PRI then becomes
an ingress path instead of a blocker for every subsystem.

## 15. Source Notes for Representative Hardware

These references are not a final approved vendor list. They document current
representative categories and capabilities:

- Sangoma Vega 100G: 1-port T1/E1/PRI gateway class.
- Patton SmartNode 4170: SIP-to-PRI gateway class.
- Grandstream GXW4200 series: high-density FXS analog station gateways.
- Grandstream GXW4104/GXW4108: older 4/8 FXO gateway class; verify current
  availability before relying on it.
- Opengear CM8100: high-density serial console server class.
