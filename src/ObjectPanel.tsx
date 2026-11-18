import { Trash2 } from "lucide-react";
import { furniture, furnitureKinds } from "./furniture";
import type { SceneObject, ObstacleKind } from "./scene";

type Props = {
  obj: SceneObject;
  onChange: (obj: SceneObject) => void;
  onRemove: (id: string) => void;
};



function NumField({
  label, value, min = 1, onChange,
}: {
  label: string; value: number; min?: number; onChange: (v: number) => void;
}) {
  return (
    <label className="op-field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        step={8}
        onChange={e => {
          const v = parseInt(e.target.value, 10);
          if (!Number.isNaN(v)) onChange(v);
        }}
      />
    </label>
  );
}

export default function ObjectPanel({ obj, onChange, onRemove }: Props) {
  const update = (patch: Partial<SceneObject>) => onChange({ ...obj, ...patch });

  return (
    <section className="inspector-section object-panel" aria-label="Selected object">
      <h2>Selected object</h2>

      <label className="op-field op-field--full">
        <span>Label</span>
        <input
          type="text"
          value={obj.label}
          maxLength={40}
          onChange={e => update({ label: e.target.value })}
        />
      </label>

      <label className="op-field"><span>Object type</span>
        <select value={obj.kind} onChange={e => update({ kind: e.target.value as ObstacleKind })}>
          {furnitureKinds.map(k => <option key={k} value={k}>{furniture[k].label}</option>)}
        </select>
      </label>

      <div className="op-grid">
        <NumField label="X (cm)" value={obj.x} min={0} onChange={v => update({ x: v })} />
        <NumField label="Y (cm)" value={obj.y} min={0} onChange={v => update({ y: v })} />
        <NumField label="W (cm)" value={obj.w} min={10} onChange={v => update({ w: v })} />
        <NumField label="H (cm)" value={obj.h} min={10} onChange={v => update({ h: v })} />
      </div>

      <button
        type="button"
        className="op-delete-btn"
        onClick={() => onRemove(obj.id)}
      >
        <Trash2 size={14} aria-hidden="true" /> Remove object
      </button>
    </section>
  );
}
