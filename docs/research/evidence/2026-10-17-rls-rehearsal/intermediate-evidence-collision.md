# Intermediate evidence filename collision

The first simultaneous normal and SIGTERM-after-setup runs began in the same millisecond and chose run-1792208591731.json. The normal run later overwrote the interrupted report. The normal process returned 0 and the signal process returned 143, but the surviving JSON is only the normal run; it is not retained evidence of signal cleanup.

The runner now includes process.pid in each report filename. Both runs are repeated on that final source and must retain separate source-matching JSON reports. No RLS candidate logic changed. No remaining /tmp/saga-rls-* directory was observed before the corrected rerun. Earlier reports remain historical.
