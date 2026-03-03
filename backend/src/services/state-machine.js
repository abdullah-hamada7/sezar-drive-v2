/**
 * StateMachine Utility
 * Encapsulates state transition rules, terminal states, and transition validation.
 */
class StateMachine {
  constructor(states, terminalStates = []) {
    this.states = states;
    this.terminalStates = terminalStates;
  }

  /**
   * Validate if a transition from `from` to `to` is allowed.
   */
  isValidTransition(from, to) {
    if (this.terminalStates.includes(from)) {
      return false;
    }
    return this.states[from]?.includes(to) || false;
  }

  /**
   * Check if a state is terminal (no outgoing transitions).
   */
  isTerminal(state) {
    return this.terminalStates.includes(state) || (this.states[state] && this.states[state].length === 0);
  }

  /**
   * Get all allowed target states from a given state.
   */
  getAllowedTransitions(from) {
    return this.states[from] || [];
  }
}

// Define the SHIFT state machine
const SHIFT_STATE_MACHINE = new StateMachine({
  PendingVerification: ['Active', 'Closed'],
  Active: ['Closed'],
  Closed: [],
}, ['Closed']);

// Define the TRIP state machine
const TRIP_STATE_MACHINE = new StateMachine({
  ASSIGNED: ['ACCEPTED', 'IN_PROGRESS', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}, ['COMPLETED', 'CANCELLED']);

module.exports = {
  StateMachine,
  SHIFT_STATE_MACHINE,
  TRIP_STATE_MACHINE,
};
