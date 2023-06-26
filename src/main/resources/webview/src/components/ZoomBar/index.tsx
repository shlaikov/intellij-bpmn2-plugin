import { ThemeType } from "../../utils/theme";
import "./style.css";

interface Props {
  zoomReset(): void;
  zoomIn(): void;
  zoomOut(): void;
  theme: ThemeType;
}

function ZoomBar({ zoomReset, zoomIn, zoomOut, theme }: Props) {
  return (
    <div className="io-zoom-controls" style={{ filter: theme === ThemeType.Light ? "invert(0)" : "invert(1)" }}>
      <ul className="io-zoom-reset io-control-list">
        <li>
          <div title="reset zoom" onClick={() => zoomReset()}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          </div>
        </li>
        <li>
          <hr />
        </li>
        <li>
          <div title="zoom in" onClick={() => zoomIn()}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </li>
        <li>
          <hr />
        </li>
        <li>
          <div title="zoom out" onClick={() => zoomOut()}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </li>
      </ul>
    </div>
  );
}

export default ZoomBar;
