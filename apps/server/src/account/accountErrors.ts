// Typed errors for the account routes to map to HTTP status codes. Everywhere else in this
// codebase (RoomManager) plain `Error` + a message is enough because the socket layer only ever
// needs `{ok: false, error: message}` — REST routes need a real status code too, hence these.

export class ValidationError extends Error {}

export class UsernameTakenError extends Error {
  constructor() {
    super('That username is already taken.');
  }
}

export class InvalidCredentialError extends Error {
  constructor(message = 'Invalid or expired credential.') {
    super(message);
  }
}

export class AccountNotFoundError extends Error {
  constructor() {
    super('Account was not found.');
  }
}
