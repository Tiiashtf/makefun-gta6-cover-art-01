// Vice City Sunset — the entry program for make.fun gta6-cover-art-01.
//
// What it does, in order:
//   1. Works out where to hand the entry in: MAKEFUN_OUTPUT_DIR outside
//      the grader, /output on the grader.
//   2. Copies the app's static files (app/) and the screenshots into it.
//   3. Writes /output/dossier.json with the kit's vendored library, so the
//      scorer can compare its own dossier byte for byte.
//
// It is deliberately boring: no network, no clock, no randomness, no
// arguments. Run it twice and the two output trees are byte-identical.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The folder this file lives in: the repository root.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// The grader's output directory, or the local stand-in for it.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps, from the competition's gate: at most 160 KiB of
// dossier text, at most 4 screenshots of at most 256 KiB each, app/ at
// most 993 files and directories and 48 MiB in all, every app path at
// most 1000 UTF-8 bytes. Passing them here makes the program refuse an
// entry the scorer would refuse, instead of handing in a bad one.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
} as const;

function handIn() {
  // Start from a clean slate, so a stale file from an earlier run can
  // never ride along into the submission.
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  // The app: every static file under app/, exactly as it sits in the repo.
  cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });

  // The screenshots: the app's own renders, 4 of them, first by name the cover.
  const shots = join(repoRoot, 'screenshots');
  if (existsSync(shots)) {
    cpSync(shots, join(outputDir, 'screenshots'), { recursive: true });
  } else {
    mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  }

  // The dossier: the judge's view of the entry, written by the kit library.
  // Built twice and compared first: the dossier must be deterministic, so
  // a program that writes two different dossiers for the same input is a
  // bug, and it should fail here, loudly, instead of handing one in.
  const first = buildDossier(outputDir, DOSSIER_CAPS);
  const second = buildDossier(outputDir, DOSSIER_CAPS);
  if (!Buffer.from(first).equals(Buffer.from(second))) throw new Error('dossier is not deterministic: two builds differ');
  const dossier = first;
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  console.log(`handed in ${dossier.length} dossier bytes to ${outputDir}`);
}

handIn();
