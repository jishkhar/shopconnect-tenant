"use client";

import {
  Add01Icon,
  Cancel01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { SEGMENT_META, SEGMENT_ORDER } from "@/lib/crm";
import { erp, fromMinor, toMinor } from "@/lib/erp";
import {
  CHANNEL_LABEL,
  FIELD_META,
  OP_LABEL,
  conditionReady,
  defaultCondition,
  type Condition,
  type ConditionField,
  type Match,
  type Preview,
} from "@/lib/rules";
import { useDebounced } from "@/lib/useDebounced";

function Multi({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <span className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange(
                on ? value.filter((v) => v !== o.value) : [...value, o.value],
              )
            }
            className={cn(
              "rounded-full border px-2.5 py-1 text-[12.5px] font-medium",
              on
                ? "border-brand-600 bg-brand-50 text-brand-800"
                : "border-line text-ink-600 hover:bg-black/[0.03]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </span>
  );
}

/** One condition: field, comparison, value. Money is typed in rupees and kept in paise. */
function Row({
  c,
  fields,
  tags,
  onChange,
  onRemove,
}: {
  c: Condition;
  fields: ConditionField[];
  tags: { id: string; name: string }[];
  onChange: (c: Condition) => void;
  onRemove?: () => void;
}) {
  const meta = FIELD_META[c.field];
  const [money, setMoney] = useState(
    meta.input === "money" && typeof c.value === "number"
      ? fromMinor(c.value)
      : "",
  );
  return (
    <div className="flex flex-wrap items-center gap-space-2 rounded-lg border border-line bg-card p-space-2">
      <Select
        value={c.field}
        onValueChange={(f) => {
          const next = defaultCondition(f as ConditionField);
          if (FIELD_META[next.field].input === "money")
            setMoney(fromMinor(next.value as number));
          onChange(next);
        }}
        className="!w-auto min-w-[190px]"
        aria-label="Condition"
      >
        {fields.map((f) => (
          <option key={f} value={f}>
            {FIELD_META[f].label}
          </option>
        ))}
      </Select>
      {meta.ops.length > 1 && (
        <Select
          value={c.op}
          onValueChange={(op) => onChange({ ...c, op: op as Condition["op"] })}
          className="!w-auto"
          aria-label="Comparison"
        >
          {meta.ops.map((op) => (
            <option key={op} value={op}>
              {OP_LABEL[op]}
            </option>
          ))}
        </Select>
      )}
      {meta.input === "money" && (
        <span className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-400">
            ₹
          </span>
          <Input
            inputMode="decimal"
            aria-label="Amount"
            className="!w-36 pl-7"
            value={money}
            onChange={(e) => {
              setMoney(e.target.value);
              const minor = toMinor(e.target.value);
              onChange({ ...c, value: minor ?? undefined });
            }}
          />
        </span>
      )}
      {meta.input === "number" && (
        <span className="flex items-center gap-1">
          <Input
            inputMode="numeric"
            aria-label="Number"
            className="!w-24"
            value={typeof c.value === "number" ? String(c.value) : ""}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              onChange({
                ...c,
                value: digits === "" ? undefined : Number(digits),
              });
            }}
          />
          {meta.unit && (
            <span className="text-[13px] text-ink-600">{meta.unit}</span>
          )}
        </span>
      )}
      {meta.input === "tiers" && (
        <Multi
          options={SEGMENT_ORDER.map((s) => ({
            value: s,
            label: SEGMENT_META[s].label,
          }))}
          value={(c.value as string[]) ?? []}
          onChange={(v) => onChange({ ...c, value: v })}
        />
      )}
      {meta.input === "channels" && (
        <Multi
          options={Object.entries(CHANNEL_LABEL).map(([value, label]) => ({
            value,
            label,
          }))}
          value={(c.value as string[]) ?? []}
          onChange={(v) => onChange({ ...c, value: v })}
        />
      )}
      {meta.input === "tags" && (
        <Multi
          options={tags.map((t) => ({ value: t.id, label: t.name }))}
          value={(c.value as string[]) ?? []}
          onChange={(v) => onChange({ ...c, value: v })}
        />
      )}
      {meta.input === "customer_type" && (
        <Select
          value={String(c.value)}
          onValueChange={(v) => onChange({ ...c, value: v })}
          className="!w-auto"
          aria-label="Customer type"
        >
          <option value="individual">Individual</option>
          <option value="business">Business (B2B)</option>
        </Select>
      )}
      {meta.input === "gender" && (
        <Select
          value={String(c.value)}
          onValueChange={(v) => onChange({ ...c, value: v })}
          className="!w-auto"
          aria-label="Gender"
        >
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </Select>
      )}
      {meta.input === "text" && (
        <Input
          aria-label="Value"
          className="!w-44"
          maxLength={80}
          value={String(c.value ?? "")}
          onChange={(e) => onChange({ ...c, value: e.target.value })}
        />
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove condition"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-black/[0.05] hover:text-ink-700"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </button>
      )}
    </div>
  );
}

/** IF these conditions (all / any) — with how many customers match right now. */
export function ConditionBuilder({
  conditions,
  match,
  onChange,
  tags = [],
  exclude = [],
  membersOnly = false,
  showPreview = true,
}: {
  conditions: Condition[];
  match: Match;
  onChange: (conditions: Condition[], match: Match) => void;
  tags?: { id: string; name: string }[];
  /** Fields this rule may not use. */
  exclude?: ConditionField[];
  /** Count members only (membership automations act on members). */
  membersOnly?: boolean;
  showPreview?: boolean;
}) {
  const fields = (Object.keys(FIELD_META) as ConditionField[]).filter(
    (f) => !exclude.includes(f),
  );
  const [keys, setKeys] = useState(() => conditions.map((_, i) => i));
  const [next, setNext] = useState(conditions.length);
  const ready = conditions.length > 0 && conditions.every(conditionReady);
  const body = useDebounced(
    ready
      ? JSON.stringify({ conditions, match, members_only: membersOnly })
      : "",
    400,
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!showPreview || !body) return;
    let live = true;
    void erp<Preview>(
      "/api/v1/crm/rules/preview",
      "POST",
      JSON.parse(body),
    ).then((res) => {
      if (!live) return;
      setPreview(res.data ?? null);
      setPreviewError(res.error ?? null);
    });
    return () => {
      live = false;
    };
  }, [body, showPreview]);

  const add = () => {
    onChange([...conditions, defaultCondition(fields[0])], match);
    setKeys([...keys, next]);
    setNext(next + 1);
  };

  return (
    <div className="space-y-space-2">
      {conditions.length > 1 && (
        <p className="flex items-center gap-space-2 text-[13px] text-ink-700">
          Match
          <Select
            value={match}
            onValueChange={(m) => onChange(conditions, m as Match)}
            className="!w-auto"
            aria-label="Match"
          >
            <option value="all">all of these</option>
            <option value="any">any of these</option>
          </Select>
        </p>
      )}
      {conditions.map((c, i) => (
        <Row
          key={keys[i] ?? i}
          c={c}
          fields={fields}
          tags={tags}
          onChange={(nc) =>
            onChange(
              conditions.map((x, j) => (j === i ? nc : x)),
              match,
            )
          }
          onRemove={
            conditions.length > 1
              ? () => {
                  onChange(
                    conditions.filter((_, j) => j !== i),
                    match,
                  );
                  setKeys(keys.filter((_, j) => j !== i));
                }
              : undefined
          }
        />
      ))}
      {conditions.length < 10 && (
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline"
        >
          <HugeiconsIcon icon={Add01Icon} size={14} /> Add condition
        </button>
      )}
      {showPreview && (
        <div className="flex items-center gap-space-3 rounded-lg bg-brand-50 p-space-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-700">
            <HugeiconsIcon icon={UserGroupIcon} size={18} />
          </span>
          <div className="min-w-0">
            {!ready ? (
              <p className="text-[13px] text-ink-600">
                Fill in the conditions to see who matches.
              </p>
            ) : previewError ? (
              <p className="text-[13px] font-medium text-error">
                {previewError}
              </p>
            ) : (
              <>
                <p className="text-[13px] text-ink-600">
                  {membersOnly
                    ? "Members matching now"
                    : "Customers matching now"}
                </p>
                <p className="text-[20px] font-bold leading-tight text-ink-900">
                  {preview ? preview.matched.toLocaleString("en-IN") : "…"}
                </p>
                {preview && preview.sample.length > 0 && (
                  <p className="truncate text-[12px] text-ink-600">
                    {preview.sample.map((s) => s.name || "Unnamed").join(", ")}
                    {preview.matched > preview.sample.length ? "…" : ""}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
