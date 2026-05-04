// ids.js
// ============================================================================
// LogicOS V1 Spine — ID generator
//
// Path:    /src/lib/ids.js
// Used by: records routes, intake route, any creation path
//
// Generates IDs of the form AREA-YYYY-NNN (zero-padded to 3 digits).
// Sequence is per (area, year) and resets on January 1.
// Increment is atomic via a SQLite transaction with conflict-resolved upsert.
// Throws on unknown area code — never silently defaults.
//
// Concurrency: better-sqlite3 with WAL mode serializes writes per database
// connection, so the transaction below is sufficient for V1's scale.
// If we ever shard the writer, this needs to become a SELECT FOR UPDATE
// equivalent (advisory lock via INSERT OR FAIL on a lock row).
// ============================================================================

'use strict';

const VALID_AREAS = Object.freeze(['PL', 'PI', 'CAM', 'LIFE', 'LAB']);

class UnknownAreaError extends Error {
  constructor(area) {
    super(`Unknown area code: ${JSON.stringify(area)}. Valid areas: ${VALID_AREAS.join(', ')}`);
    this.name = 'UnknownAreaError';
    this.code = 'unknown_area';
  }
}

function isValidArea(area) {
  return typeof area === 'string' && VALID_AREAS.includes(area);
}

/**
 * Build an ID generator bound to a database connection.
 * @param {import('better-sqlite3').Database} db
 * @returns {{ next: (area: string) => string, validAreas: () => string[] }}
 */
function createIdGenerator(db) {
  // Prepared statements bound to this db connection.
  const upsert = db.prepare(`
    INSERT INTO id_sequence (area, year, seq) VALUES (?, ?, 1)
    ON CONFLICT(area, year) DO UPDATE SET seq = seq + 1
    RETURNING seq
  `);

  // Wrap upsert in a transaction so the read-modify-write is atomic
  // even under contention. better-sqlite3 transactions are synchronous
  // and serialize automatically on a single connection.
  const incrementSeq = db.transaction((area, year) => {
    const row = upsert.get(area, year);
    if (!row || typeof row.seq !== 'number') {
      // Should be unreachable; if it happens, fail loud rather than fake an ID.
      throw new Error(`id_sequence upsert returned no row for ${area}-${year}`);
    }
    return row.seq;
  });

  /**
   * Get the next ID for the given area, in the current UTC year.
   * @param {string} area
   * @returns {string} ID like "CAM-2026-001"
   */
  function next(area) {
    if (!isValidArea(area)) {
      throw new UnknownAreaError(area);
    }
    const year = new Date().getUTCFullYear();
    const seq = incrementSeq(area, year);
    const padded = String(seq).padStart(3, '0');
    return `${area}-${year}-${padded}`;
  }

  return {
    next,
    validAreas: () => [...VALID_AREAS]
  };
}

module.exports = {
  createIdGenerator,
  UnknownAreaError,
  VALID_AREAS,
  isValidArea
};
