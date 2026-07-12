# Mesh gateway — field node install

Runs `tools/omnidat_mesh_gateway.py` (see `docs/mesh-gateway.md`) against a
serial-attached Meshtastic node on a small Linux box (Pi/NUC) with LAN or
Tailscale reach to the omnichat Bridge (`:8090`).

```bash
# one-time
sudo useradd -r -G dialout omnidat
sudo git clone <omnidat repo> /opt/omnidat
cd /opt/omnidat && python3 -m venv .venv && .venv/bin/pip install meshtastic
sudo mkdir -p /etc/omnidat /opt/omnidat/build
sudo tee /etc/omnidat/mesh-gateway.env > /dev/null << 'EOF'
OMNIDAT_BRIDGE_URL=http://<bridge-host>:8090
OMNIDAT_BRIDGE_SECRET=<INTERNAL_API_SECRET>
MESH_SERIAL=/dev/ttyUSB0
EOF
sudo chmod 600 /etc/omnidat/mesh-gateway.env

sudo cp deploy/mesh-gateway/mesh-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mesh-gateway
journalctl -u mesh-gateway -f   # expect: "OMNIDAT mesh gateway up as !<node>"
```

Notes:

- The Bridge binds its API to loopback by default; a remote field node needs
  `INTERNAL_API_BIND=0.0.0.0` on the bridge (or a Tailscale/SSH tunnel) —
  prefer the tunnel on shared networks.
- Node→account mappings live in `data/mesh-nodes.sample.json` on the field
  node's checkout; unregistered nodes act as PUBLIC guests.
- Smoke it without a radio first: `python3 -m tools.omnidat_mesh_gateway
  --simulate` and type `DIR`, then `MSG`/`MAIL` between the two seeded nodes.
