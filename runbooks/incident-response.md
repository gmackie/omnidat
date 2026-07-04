# Incident Response

## Severity

```text
notice            user-visible but not service-impacting
service-degraded  one service degraded, workarounds available
service-down      one service unavailable
safety            power, RF, mechanical, or crowd safety concern
```

## First Actions

1. Protect people first.
2. Stop motion/RF/power if safety is involved.
3. Mark affected service in maintenance mode.
4. Tell TrustDesk what callers should hear.
5. Open an incident record.
6. Recover or bypass.
7. Print incident closeout when resolved.

## Incident Classes

```text
TELCO   PRI, ShadyTel trunk, called digits, channel exhaustion
PBX     dial plan, endpoint, hunt group, IVR
DATA    modem, PAD, BBS, terminal service
DOC     fax, printer, form queue
MEDIA   robot, VCR, tape, video chain
ATV     amateur TV station chain
SYNC    field kit uplink, authority failover, journal reconciliation
SAFETY  mechanical, electrical, RF, crowd
```

## Field Kit Authority

A SYNC incident (field kit uplink lost, or authority needs to move between the
field kit and the cloud) follows [Authority Failover](authority-failover.md).
Failover is a deliberate NOC action, never automatic; stale-epoch writes are
quarantined, not dropped, so a wrong call is recoverable.

## Maintenance Mode Rule

If a service has failed twice in ten minutes, put it in maintenance mode before
attempting a third live recovery. Operators can keep working on it, but callers
should receive an explicit intercept.

## Closeout Fields

```text
INCIDENT ID:
CLASS:
SEVERITY:
START:
END:
SUMMARY:
AFFECTED NUMBERS:
ROOT CAUSE:
WORKAROUND:
PERMANENT FIX:
OPERATOR INITIALS:
```

