# ShadyTel Interop Test

## Preconditions

- PRI handoff or simulator is connected.
- ShadyTel and OMNIDAT operators are in voice/contact range.
- PRI settings sheet is present.
- OMNIDAT PBX is running with current service map.

## Physical Layer

- Confirm PRI link state.
- Confirm clock source.
- Confirm framing and line coding.
- Confirm D-channel status.

Record:

```text
DATE:
SHADYTEL OPERATOR:
OMNIDAT OPERATOR:
FRAMING:
LINE CODING:
SWITCH TYPE:
CLOCK SOURCE:
CHANNEL COUNT:
```

## Called Number Test

ShadyTel places calls to:

```text
8800
8801
8802
8805
8810
8814
8818
8819
8820
8822
```

For each call, OMNIDAT records:

```text
CALLED NUMBER RECEIVED:
CALLER ID RECEIVED:
ROUTE SELECTED:
RESULT:
```

## Capacity Test

- Place simultaneous calls until the expected limit is reached.
- Confirm service-specific channel limits.
- Confirm exhausted hunt groups return busy or intercept.
- Confirm unrelated services still work where channel policy allows.

## Failure Test

- Drop/recover PRI if ShadyTel agrees.
- Confirm PBX logs loss and recovery.
- Confirm `8801` status can be updated.
- Confirm operator escalation path.

## Signoff

```text
SHADYTEL OPERATOR INITIALS:
OMNIDAT OPERATOR INITIALS:
OPEN ISSUES:
NEXT TEST DATE:
```

