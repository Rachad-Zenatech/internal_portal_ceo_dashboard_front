export type ClientErrorType = "react" | "runtime" | "unhandled_promise";

export function reportClientError(
  _errorType: ClientErrorType,
  _value: unknown,
  _componentStack?: string,
): void {
  // Silent in dev and safe against infinite loops when API is offline
}

export function installGlobalErrorReporting(): void {
  // Disabled global unhandledrejection network trapping to prevent recursive thread freezes
}
