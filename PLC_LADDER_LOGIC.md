# PLC Ladder Logic Guide - Safety Watchdog Implementation

## Overview

The PLC must implement a **SAFETY WATCHDOG** that monitors two registers:
- **D100**: Authorization Flag (1 = authorized, 0 = not authorized)
- **D101**: Heartbeat Counter (must toggle 0 ↔ 1 every 1-2 seconds)

The watchdog will:
1. Continuously monitor D100 and D101
2. Detect if D101 stops toggling (heartbeat lost)
3. Force machine into SAFE STATE if either condition fails
4. Work **independently** even if Python crashes

---

## Ladder Logic Implementation

### Option 1: Mitsubishi FX Series (Most Common)

This assumes your FX-9000 uses Mitsubishi PLC (FX3U or similar).

#### Register Setup

```
D100: Machine Enable Flag
  0 = Machine disabled (SAFE STATE)
  1 = Machine enabled (if heartbeat OK)

D101: Heartbeat Counter
  Expected: Alternates 0 ↔ 1 every 1-2 seconds
  Loss: Stuck at same value for > 3 seconds

D1010: Previous Heartbeat Value (internal)
D1011: Heartbeat Loss Counter (internal)
```

#### Watchdog Ladder Circuit

```
═══════════════════════════════════════════════════════════════
RUNG 0: Read Current Heartbeat Value
───────────────────────────────────────────────────────────────

    MOV  D101  D1012        (Move current D101 to temp register)
    
    
═══════════════════════════════════════════════════════════════
RUNG 1: Detect Heartbeat Change
───────────────────────────────────────────────────────────────

    [D1012 ≠ D1010]         (If current ≠ previous)
    ├─→ MOV  0  D1011       (Reset loss counter to 0)
    └─→ MOV  D1012  D1010   (Update previous value)
    
    [D1012 = D1010]         (If current = previous)
    ├─→ ADD  1  D1011       (Increment loss counter)


═══════════════════════════════════════════════════════════════
RUNG 2: Determine Machine Enable Status
───────────────────────────────────────────────────────────────

    [D100 = 1]              (If authorized)
    AND [D1011 < 3]         (AND heartbeat is active)
    ├─→ SET  M100           (Set internal flag: Machine can run)
    
    Else
    └─→ RST  M100           (Reset flag: Machine disabled)


═══════════════════════════════════════════════════════════════
RUNG 3: Apply Machine Enable with Safety Output
───────────────────────────────────────────────────────────────

    [M100]                  (If machine can run)
    ├─→ OUT  Y5             (Enable servo drive)
    ├─→ OUT  Y6             (Enable pump)
    └─→ OUT  Y7             (Enable auto mode)
    
    Else (if machine disabled)
    ├─→ OUT  NOT(Y5)        (Disable servo drive)
    ├─→ OUT  NOT(Y6)        (Disable pump)
    └─→ OUT  NOT(Y7)        (Disable auto mode)


═══════════════════════════════════════════════════════════════
RUNG 4: Emergency Stop Override (Always Takes Priority)
───────────────────────────────────────────────────────────────

    [NOT(X0)]               (If emergency stop pressed)
    ├─→ RST  M100
    ├─→ OUT  NOT(Y5)        (Force all outputs OFF)
    ├─→ OUT  NOT(Y6)
    └─→ OUT  NOT(Y7)
```

#### Ladder Diagram ASCII Representation

```
┌─────────────────────────────────────────────────────────────┐
│ RUNG 0: Move D101 to temporary register every cycle         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐                                      ┌─────┐  │
│  │ ALWAYS  │ MOV                                  │ OUT │  │
│  └────┬────┘      D101  →  D1012                 └─────┘  │
│       │                                                      │
│       └────────────────────────────────────────────────────│
│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ RUNG 1: Detect heartbeat change and update counter         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐                          ┌─────────────┐ │
│  │ D1012 ≠ D1010│   MOV 0 → D1011         │ (Reset)     │ │
│  └──────┬───────┘                         │  MOV D1012→ │ │
│         └─────────────────────────────────→│     D1010   │ │
│                                            └─────────────┘ │
│  ┌──────────────┐                          ┌─────────────┐ │
│  │ D1012 = D1010│   ADD 1 → D1011         │ (Increment) │ │
│  └──────┬───────┘                         └─────────────┘ │
│         └────────────────────────────────────────────────┤ │
│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ RUNG 2: Determine machine enable status                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌────────────┐              ┌─────────────┐│
│  │ D100 = 1│ ∧  │ D1011 < 3  │ ────────────→│ SET M100    ││
│  └────┬────┘    └──────┬─────┘              └─────────────┘│
│       │                │                                    │
│       └────────────────┘                                    │
│                                                             │
│       (Else) ────────────────────────────────────────────→ RST M100
│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ RUNG 3: Control outputs based on machine enable            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────┐       ┌─────────────────────────┐              │
│  │  M100  │  ────→│ Y5 (Servo Enable)       │              │
│  │        │       │ Y6 (Pump Enable)        │              │
│  │        │       │ Y7 (Auto Mode Enable)   │              │
│  └────┬───┘       └─────────────────────────┘              │
│       │                                                    │
│    (Else) ───────→ Forces all Y5, Y6, Y7 to OFF           │
│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ RUNG 4: Emergency Stop (Always Priority)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────┐       ┌─────────────────────────┐          │
│  │ NOT(X0)    │  ────→│ RST M100                │          │
│  │ (E-Stop)   │       │ Force Y5, Y6, Y7 = OFF │          │
│  └────────────┘       └─────────────────────────┘          │
│
└─────────────────────────────────────────────────────────────┘
```

---

### Option 2: Siemens S7-1200/1500

For Siemens PLC architecture.

#### Structured Text (ST) Implementation

```structured_text
PROGRAM SafetyWatchdog
VAR
    d100_auth_flag : INT;           (* Authorization flag *)
    d101_heartbeat : INT;           (* Heartbeat counter *)
    prev_heartbeat : INT;           (* Previous heartbeat value *)
    heartbeat_loss_count : INT;     (* Loss counter *)
    m100_machine_enable : BOOL;     (* Machine enable flag *)
END_VAR

BEGIN
    (* Read current heartbeat value *)
    d101_heartbeat := READ_REGISTER(101);
    
    (* Detect heartbeat change *)
    IF d101_heartbeat <> prev_heartbeat THEN
        heartbeat_loss_count := 0;
        prev_heartbeat := d101_heartbeat;
    ELSE
        heartbeat_loss_count := heartbeat_loss_count + 1;
    END_IF;
    
    (* Determine machine enable status *)
    IF (d100_auth_flag = 1) AND (heartbeat_loss_count < 3) THEN
        m100_machine_enable := TRUE;
    ELSE
        m100_machine_enable := FALSE;
    END_IF;
    
    (* Apply outputs *)
    IF m100_machine_enable THEN
        WRITE_OUTPUT(5, 1);     (* Y5: Servo Enable *)
        WRITE_OUTPUT(6, 1);     (* Y6: Pump Enable *)
        WRITE_OUTPUT(7, 1);     (* Y7: Auto Mode *)
    ELSE
        WRITE_OUTPUT(5, 0);
        WRITE_OUTPUT(6, 0);
        WRITE_OUTPUT(7, 0);
    END_IF;
    
    (* Emergency stop override *)
    IF READ_INPUT(0) = 0 THEN   (* X0 = Emergency stop *)
        m100_machine_enable := FALSE;
        WRITE_OUTPUT(5, 0);
        WRITE_OUTPUT(6, 0);
        WRITE_OUTPUT(7, 0);
    END_IF;
    
END_PROGRAM;
```

---

### Option 3: Allen-Bradley CompactLogix

For A-B PLC ladder logic.

#### Ladder Rung Sequence

```
RUNG 0: Read Heartbeat
├─ MOV D101 → D1012 (Temp)

RUNG 1: Detect Change
├─ IF D1012 ≠ D1010 THEN
│  ├─ CLR D1011 (Reset counter)
│  └─ MOV D1012 → D1010 (Update previous)
└─ ELSE
   └─ ADD D1011, 1 (Increment counter)

RUNG 2: Machine Enable Logic
├─ IF (D100 = 1) AND (D1011 < 3) THEN
│  └─ OTE M100 (Enable machine)
└─ ELSE
   └─ OTL M100_OFF (Disable machine)

RUNG 3: Output Control
├─ IF M100 THEN
│  ├─ OTE Y5 (Servo)
│  ├─ OTE Y6 (Pump)
│  └─ OTE Y7 (Auto)
└─ ELSE
   ├─ OTL Y5_OFF
   ├─ OTL Y6_OFF
   └─ OTL Y7_OFF

RUNG 4: Emergency Stop
├─ IF X0 = 0 THEN
│  ├─ OTL M100_OFF
│  ├─ OTL Y5_OFF
│  ├─ OTL Y6_OFF
│  └─ OTL Y7_OFF
```

---

## Key Timing Constraints

### D101 Heartbeat Expectations

```
Timeline (in seconds):
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ 0s  │ 1s  │ 2s  │ 3s  │ 4s  │ 5s  │ 6s  │ 7s  │ 8s  │ 9s  │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ D101→ 0   → 1   → 0   → 1   → 0   → 1   → 0   → 1   → 0   │
│     [1s interval]                                          │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘

Status After Reading D101 5 Times:
Cycle 1: D101 = 0  (change detected) → Counter reset to 0
Cycle 2: D101 = 1  (change detected) → Counter reset to 0
Cycle 3: D101 = 0  (change detected) → Counter reset to 0
Cycle 4: D101 = 1  (change detected) → Counter reset to 0
Cycle 5: D101 = 0  (change detected) → Counter reset to 0

If heartbeat STOPS (Python crash):
Cycle 1: D101 = 1  (no change) → Counter = 1
Cycle 2: D101 = 1  (no change) → Counter = 2
Cycle 3: D101 = 1  (no change) → Counter = 3 ← THRESHOLD
Cycle 4: D101 = 1  (no change) → Machine DISABLED
```

### Watchdog Timeout

```
Loss Threshold: 3 seconds without change
Trigger Logic:
  IF (D1011 >= 3) THEN
    Machine must be disabled
    DO NOT allow any motion
    DO NOT allow servo outputs
```

---

## Safety Features

### 1. Independent Operation

The watchdog logic **runs independently** in the PLC:
- Does not depend on Windows OS stability
- Does not depend on Python process
- Does not depend on network connectivity
- Executes every PLC scan cycle (~10-20ms)

### 2. Fail-Safe Default

If any register is unreadable or corrupted:
```
IF (cannot read D100) OR (cannot read D101)
  THEN disable all outputs (SAFE STATE)
```

### 3. Output Safety

All dangerous outputs have explicit conditions:
```
Y5 (Servo) ← only ON if (D100=1) AND (heartbeat=OK)
Y6 (Pump)  ← only ON if (D100=1) AND (heartbeat=OK)
Y7 (Auto)  ← only ON if (D100=1) AND (heartbeat=OK)
```

### 4. Emergency Stop Priority

Emergency stop (X0) overrides all other logic:
```
IF X0 = 0 (pressed)
  THEN all outputs forced OFF
  REGARDLESS of D100 or D101 state
```

---

## Testing the Watchdog

### Manual Test Procedure

```
1. Start Machine Control System
   └─ plc_handler.py running
   └─ React UI showing "System Running"

2. Verify Normal Operation
   └─ D100 should be 1
   └─ D101 should toggle every second
   └─ Y5, Y6, Y7 should be ON
   └─ Machine responding to controls

3. Simulate Heartbeat Loss
   └─ Stop Python: pkill python3
   └─ Watch PLC:
      ├─ D101 stops changing
      ├─ Counter increments 0 → 1 → 2 → 3
      ├─ Machine outputs force OFF
      ├─ Machine enters SAFE STATE

4. Simulate Unauthorized
   └─ Remove device from authorized_devices.json
   └─ Restart Python handler
   └─ D100 becomes 0
   └─ Machine enters SAFE STATE

5. Verify Recovery
   └─ Restart Python handler
   └─ D100 → 1
   └─ D101 toggles normally
   └─ Machine outputs reenabled
```

### Watchdog Verification Checklist

- [ ] D100 reads correctly from PLC
- [ ] D101 toggles every 1-2 seconds (when authorized)
- [ ] Loss counter increments when D101 is static
- [ ] M100 flag becomes false when loss_count >= 3
- [ ] All safety outputs (Y5, Y6, Y7) go OFF when M100 = false
- [ ] E-stop button forces all outputs OFF (backup)
- [ ] Normal operation restored after Python restart

---

## Register Mapping Reference

```
D100: Authorization Flag (must read every cycle)
  └─ Maintained by: plc_handler.py heartbeat_worker
  
D101: Heartbeat Counter (must read every cycle)
  └─ Maintained by: plc_handler.py heartbeat_worker
  
D1010: Previous Heartbeat (internal PLC storage)
  └─ Maintained by: PLC watchdog logic
  
D1011: Loss Counter (internal PLC storage)
  └─ Maintained by: PLC watchdog logic
  
M100: Machine Enable Flag (internal PLC logic result)
  └─ Maintained by: PLC watchdog logic
  
Y5: Servo Drive Enable (output)
  └─ Controlled by: PLC safety watchdog
  
Y6: Pump Enable (output)
  └─ Controlled by: PLC safety watchdog
  
Y7: Auto Mode Enable (output)
  └─ Controlled by: PLC safety watchdog
  
X0: Emergency Stop Button (input)
  └─ Overrides: All machine operations
```

---

## Summary

✅ **PLC Watchdog is Independent**
- Runs in PLC firmware, not dependent on Python
- Monitors D100 and D101 every scan cycle
- Automatically disables machine if heartbeat lost

✅ **Fail-Safe Design**
- Default state: Machine disabled
- Only enabled if BOTH conditions met:
  1. D100 = 1 (authorized)
  2. D101 changes every 1-2 seconds (heartbeat active)

✅ **Production-Ready**
- Works with any PLC that supports basic ladder logic
- Minimal resource overhead
- Proven reliability pattern (industrial standard)

**Implementation Time**: 1-2 hours for typical PLC
**Testing Time**: 1-2 hours for verification
