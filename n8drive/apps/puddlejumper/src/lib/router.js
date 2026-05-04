// router.js
// ============================================================================
// LogicOS V1 Spine — area router
//
// Path:    /src/lib/router.js
// Used by: records routes, intake route, anywhere a record gets created
//
// PURE FUNCTION. Takes an area code (and an optional override flag for PI),
// returns a routing decision. Does not touch the database, does not call
// connectors, does not produce side effects of any kind. This is enforced
// by keeping it dependency-free.
//
// V1 mappings:
//   CAM   -> google   (folder)   — WIRED in V1
//   LIFE  -> google   (folder)   — WIRED in V1
//   PL    -> m365     (folder)   — connector not implemented; will queue
//   PI    -> m365     (folder)   — connector not implemented; will queue
//                                  homeOverride: 'google' allowed for PI only
//   LAB   -> github   (repo)     — connector not implemented; will queue
//
// When PI gets a Google override (homeOverride === 'google'), it will need
// its own parent folder env var. PI currently has no parent folder
// configured. Add GOOGLE_DRIVE_PARENT_PI when PI Google routing is enabled.
// (Not in V1.)
// ============================================================================

'use strict';

const { isValidArea, UnknownAreaError } = require('./ids');

class InvalidOverrideError extends Error {
  constructor(area, override) {
    super(
      `Home override ${JSON.stringify(override)} not allowed for area ${JSON.stringify(area)}. ` +
      `Override is only valid for PI.`
    );
    this.name = 'InvalidOverrideError';
    this.code = 'invalid_override';
  }
}

const ROUTING_TABLE = Object.freeze({
  PL:   { home: 'm365',   destination: 'folder' },
  PI:   { home: 'm365',   destination: 'folder' },
  CAM:  { home: 'google', destination: 'folder' },
  LIFE: { home: 'google', destination: 'folder' },
  LAB:  { home: 'github', destination: 'repo'   }
});

const VALID_OVERRIDES = Object.freeze({
  PI: Object.freeze(['google'])
});

const CONNECTOR_IMPLEMENTED = Object.freeze({
  google: true,
  m365:   false,
  github: false
});

/**
 * Decide where a record of a given area belongs.
 *
 * @param {string} area               Area code: PL, PI, CAM, LIFE, LAB
 * @param {object} [opts]
 * @param {string} [opts.homeOverride] Optional home override. PI only, value 'google'.
 * @returns {{
 *   home: 'google' | 'm365' | 'github',
 *   destination: 'folder' | 'doc' | 'issue' | 'repo',
 *   connectorImplemented: boolean,
 *   initialConnectorState: 'queued' | 'not_started'
 * }}
 *
 * The returned `initialConnectorState` is the truthful starting state for
 * the record's connector_state column:
 *   - 'queued' when a connector exists for the chosen home
 *   - 'not_started' when the connector is not yet implemented
 *
 * Never returns a fake 'completed' or hidden error state. The router's
 * job is to decide; running the connector is someone else's job.
 */
function route(area, opts = {}) {
  if (!isValidArea(area)) {
    throw new UnknownAreaError(area);
  }

  const { homeOverride } = opts;
  let decision = ROUTING_TABLE[area];

  if (homeOverride !== undefined) {
    const allowed = VALID_OVERRIDES[area];
    if (!allowed || !allowed.includes(homeOverride)) {
      throw new InvalidOverrideError(area, homeOverride);
    }
    decision = { home: homeOverride, destination: 'folder' };
  }

  const connectorImplemented = CONNECTOR_IMPLEMENTED[decision.home] === true;

  return {
    home: decision.home,
    destination: decision.destination,
    connectorImplemented,
    initialConnectorState: connectorImplemented ? 'queued' : 'not_started'
  };
}

module.exports = {
  route,
  InvalidOverrideError,
  ROUTING_TABLE,
  CONNECTOR_IMPLEMENTED
};
