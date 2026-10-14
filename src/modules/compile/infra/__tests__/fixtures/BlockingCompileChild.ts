import { writeFileSync } from 'node:fs';

// Exercises parent termination against a child that cannot service timers or IPC.
process.once('message', (input: { outputPath: string }) => {
  writeFileSync(`${input.outputPath}.started`, String(process.pid));
  for (;;) { /* Deliberately block only this disposable child process. */ }
});
