export class SidecarInvariantError extends Error {
  override readonly name = 'SidecarInvariantError'
}

export class SidecarForkUncertainError extends Error {
  override readonly name = 'SidecarForkUncertainError'

  constructor(
    message = 'Fork outcome is uncertain. Check existing branches before retrying.',
  ) {
    super(message)
  }
}
