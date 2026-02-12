const ALLOWED_TRANSITIONS = {
  idle: ["validating"],
  validating: ["deploying", "error"],
  deploying: ["complete", "error"],
  complete: ["idle"],
  error: ["idle"]
};

export function createDeploymentStateMachine() {
  return {
    phase: "idle",
    phaseUpdatedAt: new Date().toISOString(),
    lastPhaseDetail: "Initialized.",
    lastDeployTime: null,
    lastResult: null,
    lastSuccessTime: null,
    lastDeploymentId: null,
    lastCommitSha: null,
    lastStdoutExcerpt: "",
    lastStderrExcerpt: "",
    lastErrorLines: [],
    lastDeploymentReason: "",
    runningDeployment: null,
    emergencyDeclaration: null,
    lastEmergencyDeployTime: null
  };
}

export function canStartDeployment(state) {
  return state.phase === "idle";
}

export function transitionDeploymentPhase(state, nextPhase, detail = "") {
  const allowed = ALLOWED_TRANSITIONS[state.phase] || [];
  if (!allowed.includes(nextPhase)) {
    throw new Error(
      `Veritas: Invalid deployment phase transition from '${state.phase}' to '${nextPhase}'.`
    );
  }

  state.phase = nextPhase;
  state.phaseUpdatedAt = new Date().toISOString();
  state.lastPhaseDetail = detail;
}

export function resetDeploymentPhaseToIdle(state, detail = "Ready for next deployment.") {
  state.phase = "idle";
  state.phaseUpdatedAt = new Date().toISOString();
  state.lastPhaseDetail = detail;
}
