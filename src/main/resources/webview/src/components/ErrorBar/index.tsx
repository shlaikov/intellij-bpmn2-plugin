import "./style.css";

export interface EventError {
  warnings: Array<{
    warnings: Array<{
      error: {
        message: string;
        stack: string;
      };
      message: string;
    }>;
  }>;
  message: string;
  stack: string;
}

interface Props {
  error: EventError | null;
}

function InvalidState({ error }: Props) {
  if (!error) {
    return null;
  }

  return (
    <div className="io-error-bar">
      <div className="io-error-bar__header">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
        </svg>

        <p className="io-error-bar__header-title">Error:</p>
      </div>

      <pre className="io-error-bar__message">{error.message}</pre>
    </div>
  );
}

export default InvalidState;
