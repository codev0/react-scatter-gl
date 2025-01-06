import { FC } from "react";

export const Nav: FC<{
  onAddPoints: () => void;
  onRemovePoints: () => void;
}> = (props) => {
  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "50px",
        zIndex: 10,
      }}
    >
      <button onClick={props.onAddPoints}>Add points</button>
      <button onClick={props.onRemovePoints}>Remove points</button>
    </nav>
  );
};
