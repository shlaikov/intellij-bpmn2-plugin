import "./style.css";

interface Props {
  text: string;
}

/** A centred notice shown instead of a diagram. */
function Message({ text }: Props) {
  return (
    <div className="io-message">
      <h4>{text}</h4>
    </div>
  );
}

export default Message;
