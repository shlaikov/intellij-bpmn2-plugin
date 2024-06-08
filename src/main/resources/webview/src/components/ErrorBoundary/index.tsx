import "./style.css";

import { ThemeType } from "../../utils/theme";

interface Props {
  text: string;
  theme: ThemeType;
}

function ErrorBoundary({ text, theme }: Props) {
  if (!text) {
    return null;
  }

  return (
    <div className="io-error-boundary" style={{ filter: theme === ThemeType.Light ? "invert(0)" : "invert(1)" }}>
      <h4 style={{ color: "#555555" }}>{ text }</h4>
    </div>
  );
}

export default ErrorBoundary;
