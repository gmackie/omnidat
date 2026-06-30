# Shadybucks Carrier Network

## Positioning

OMNIDAT is the private carrier/access network for Shadybucks commerce at
ToorCamp 2028. Shadybucks remains the bank and ledger. ShadyPay remains the SDK
and merchant-terminal/payment UI surface. OMNIDAT provides the dial, packet,
terminal, and operations network that lets trusted devices reach those systems.

OMNIDAT should not hold itself out as the bank. It is the carrier, switch,
service bureau, terminal network, and settlement operations desk for business
devices.

```text
Shadybucks bank / bucks.shady.tel
        ^
        | trusted merchant/token side only
        |
OMNIDAT Merchant Carrier Network
        ^
        |
ATMs, POS terminals, merchant proxy hosts,
NiteMarkt BOH/WMS, vendor terminals, operator consoles
```

## Trust Boundary

ShadyPay has two trust modes:

- `directGateway`: trusted merchant devices may hold merchant tokens.
- `proxyGateway`: payer-facing browsers never hold merchant tokens; a merchant
  proxy holds the token server-side.

OMNIDAT should treat both as carrier customers:

- A trusted POS terminal may connect directly to Shadybucks over OMNIDAT.
- A payer-facing kiosk or web checkout should connect to a merchant proxy on
  OMNIDAT; the proxy talks to Shadybucks with the merchant token.
- ATMs are high-trust terminal endpoints with stricter operator, audit, and
  physical controls.
- BOH/WMS systems are private business systems, not camper-facing terminals.

## Carrier Services

| Service | Purpose | Access |
|---|---|---|
| ATM access circuit | Shadybucks cash/card terminal access | dedicated terminal or PAD |
| POS authorization circuit | purchase/preauth/capture terminals | trusted POS terminal |
| Merchant proxy circuit | payer-facing proxy backend transport | server host |
| Settlement circuit | end-of-day batch, capture, void, reverse, reports | BOH/operator |
| NiteMarkt WMS circuit | inventory receiving, picks, stock counts, register close | BOH terminal |
| Vendor services circuit | miscellaneous vendor terminals and proxy servers | vendor-specific |
| Operations circuit | TrustDesk, incident handling, terminal disable/enable | operator |

## Packet Service Addresses

OMNIDAT Packet Clearing should expose finance/business service addresses
separately from novelty/demo services.

```text
000010  SHADYBUCKS ATM SWITCH
000011  SHADYBUCKS POS AUTHORIZATION
000012  MERCHANT PROXY REGISTRY
000013  SETTLEMENT BATCH SERVICE
000014  TERMINAL MANAGEMENT
000020  NITEMARKT BOH WMS
000021  NITEMARKT RECEIVING
000022  NITEMARKT STOCK COUNT
000030  VENDOR SERVICES DIRECTORY
000031  VENDOR POS PROVISIONING
000099  TEST LOOP
```

## Device Classes

### ATM

An ATM is a physically controlled Shadybucks terminal. It should have an
assigned terminal ID, assigned vendor/owner, assigned circuit, operator-visible
status, event logging, and no general web access.

### POS Terminal

A POS terminal is a trusted merchant device. It can use ShadyPay `directGateway`
if it is physically controlled and provisioned with a merchant token. It should
be disableable by OMNIDAT operators without touching the bank.

### Merchant Proxy

A merchant proxy is the secure server side for payer-facing checkout. It holds
the merchant token. Payer devices talk to the proxy; the proxy talks to
Shadybucks through OMNIDAT.

### BOH/WMS

Back-of-house systems are private business operations terminals. NiteMarkt is
the anchor use case: receiving, stock count, register close, settlement reports,
vendor account lookups, and print/fax exception forms.

### Vendor Terminal

Miscellaneous vendor terminals can be provisioned with narrower access: POS
only, proxy only, settlement only, or directory/read-only access.

## Operations Model

OMNIDAT owns carrier controls:

- assign terminal IDs
- assign circuits
- mark terminal active/suspended/maintenance
- rotate local terminal secrets or proxy credentials
- print provisioning sheets
- produce daily settlement/access summaries
- disable terminals during incidents

Shadybucks owns bank controls:

- account authority
- merchant token minting
- authorization/capture/void/reverse semantics
- ledger correctness
- balance and transaction records

## NiteMarkt Role

NiteMarkt should be the anchor tenant for proving the carrier network:

```text
NiteMarkt register/POS
NiteMarkt ATM/cash desk
NiteMarkt BOH WMS terminal
NiteMarkt settlement printer/fax path
NiteMarkt operator escalation
```

If NiteMarkt works, miscellaneous vendors become smaller copies of the same
pattern.

## Launch Slice

V1 should prove:

1. One Shadybucks POS terminal path.
2. One merchant proxy path.
3. One ATM or ATM simulator path.
4. One NiteMarkt BOH/WMS terminal path.
5. One vendor terminal path.
6. Daily printed carrier/settlement summary.
7. Operator disable/maintenance path for one terminal.
