import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { JSONSchema } from "@agentable/core";
import { useAgentCapability } from "./useAgentCapability.js";
import type { AgentProp } from "./types.js";

export type FieldType = "text" | "email" | "url" | "number" | "integer" | "boolean" | "select" | "textarea" | "date" | "password";

export interface FieldMeta {
  name: string;
  type: FieldType;
  describe?: string;
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  options?: Array<{ value: string; label?: string }>;
  /** Exclude from the agent schema (e.g. passwords). */
  agentHidden?: boolean;
}

export type FormValues = Record<string, unknown>;

interface FormContextValue {
  values: FormValues;
  errors: Record<string, string>;
  setValue: (name: string, value: unknown) => void;
  register: (meta: FieldMeta) => () => void;
  formId: string;
  submitting: boolean;
  /** Set while an agent is filling the form. Lets fields flash. */
  agentTouched: Set<string>;
}

const FormContext = createContext<FormContextValue | null>(null);

export function useFormContext(): FormContextValue {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("<Field> must be inside <Form>.");
  return ctx;
}

export interface FormProps {
  children?: ReactNode;
  agent?: AgentProp;
  /** Controlled values. */
  values?: FormValues;
  /** Initial values when uncontrolled. */
  defaultValues?: FormValues;
  onChange?: (values: FormValues) => void;
  /** Return a value to hand back to the agent (kept short). Throw to fail. */
  onSubmit: (values: FormValues, meta: { fromAgent: boolean }) => unknown | Promise<unknown>;
  /** Extra validation. Return a map of field -> message. */
  validate?: (values: FormValues) => Record<string, string> | undefined;
  className?: string;
  id?: string;
  /** Rendered after children; defaults to a submit button. Pass null to omit. */
  actions?: ReactNode | null;
  submitLabel?: string;
}

/**
 * A form that derives its agent tool from its own fields. One tool: fill and
 * submit. Consequential by default, so the built-in confirmation shows.
 */
export function Form({ children, agent, values: controlled, defaultValues, onChange, onSubmit, validate, className, id, actions, submitLabel = "Submit" }: FormProps) {
  const [inner, setInner] = useState<FormValues>(defaultValues ?? {});
  const values = controlled ?? inner;
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [agentTouched, setAgentTouched] = useState<Set<string>>(() => new Set());
  const fields = useRef(new Map<string, FieldMeta>());
  const [fieldVersion, setFieldVersion] = useState(0);
  const generatedId = useId();
  const formId = id ?? generatedId;

  const setValue = useCallback(
    (name: string, value: unknown) => {
      const next = { ...valuesRef.current, [name]: value };
      valuesRef.current = next;
      if (controlled === undefined) setInner(next);
      onChange?.(next);
      setErrors((e) => (e[name] ? { ...e, [name]: "" } : e));
    },
    [controlled, onChange],
  );

  const register = useCallback((meta: FieldMeta) => {
    fields.current.set(meta.name, meta);
    setFieldVersion((v) => v + 1);
    return () => {
      fields.current.delete(meta.name);
      setFieldVersion((v) => v + 1);
    };
  }, []);

  const runValidation = useCallback(
    (vals: FormValues): Record<string, string> => {
      const errs: Record<string, string> = {};
      for (const f of fields.current.values()) {
        const v = vals[f.name];
        const empty = v === undefined || v === null || v === "";
        if (f.required && empty) errs[f.name] = "Required";
        else if (!empty) {
          if ((f.type === "number" || f.type === "integer") && typeof v === "number") {
            if (f.min !== undefined && v < f.min) errs[f.name] = `Must be at least ${f.min}`;
            if (f.max !== undefined && v > f.max) errs[f.name] = `Must be at most ${f.max}`;
            if (f.type === "integer" && !Number.isInteger(v)) errs[f.name] = "Must be a whole number";
          }
          if (typeof v === "string") {
            if (f.minLength !== undefined && v.length < f.minLength) errs[f.name] = `At least ${f.minLength} characters`;
            if (f.maxLength !== undefined && v.length > f.maxLength) errs[f.name] = `At most ${f.maxLength} characters`;
            if (f.pattern && !new RegExp(f.pattern).test(v)) errs[f.name] = "Invalid format";
            if (f.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) errs[f.name] = "Invalid email";
          }
          if (f.options && !f.options.some((o) => o.value === v)) errs[f.name] = "Not an allowed option";
        }
      }
      return { ...errs, ...(validate?.(vals) ?? {}) };
    },
    [validate],
  );

  const submit = useCallback(
    async (fromAgent: boolean): Promise<unknown> => {
      const vals = valuesRef.current;
      const errs = runValidation(vals);
      const failing = Object.entries(errs).filter(([, m]) => m);
      setErrors(errs);
      if (failing.length) {
        const err = new Error(`Validation failed: ${failing.map(([k, m]) => `${k}: ${m}`).join("; ")}`);
        throw err;
      }
      setSubmitting(true);
      try {
        return await onSubmit(vals, { fromAgent });
      } finally {
        setSubmitting(false);
      }
    },
    [onSubmit, runValidation],
  );

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(false).catch(() => {});
  };

  const schema = useMemo<JSONSchema>(() => {
    void fieldVersion;
    const properties: Record<string, JSONSchema> = {};
    const required: string[] = [];
    for (const f of fields.current.values()) {
      if (f.agentHidden) continue;
      properties[f.name] = fieldSchema(f);
      if (f.required) required.push(f.name);
    }
    const s: JSONSchema = { type: "object", properties };
    if (required.length) s.required = required;
    return s;
  }, [fieldVersion]);

  const fieldNames = useMemo(() => {
    void fieldVersion;
    return [...fields.current.keys()].filter((n) => !fields.current.get(n)?.agentHidden);
  }, [fieldVersion]);

  useAgentCapability(
    "form",
    agent,
    useMemo(
      () => ({
        description: `Fill in and submit the ${agent?.title ?? agent?.name ?? "form"} form. Fields: ${fieldNames.join(", ") || "(none)"}. Provided fields overwrite current values; omitted fields keep what the user entered.`,
        inputSchema: schema,
        annotations: { readOnlyHint: false, consequentialHint: true },
        confirm: true,
        execute: async (args: FormValues) => {
          const touched = new Set<string>();
          for (const [k, v] of Object.entries(args)) {
            if (!fields.current.has(k)) continue;
            setValue(k, coerce(fields.current.get(k)!, v));
            touched.add(k);
          }
          setAgentTouched(touched);
          setTimeout(() => setAgentTouched(new Set()), 1500);
          const result = await submit(true);
          return result === undefined ? { submitted: true, values: valuesRef.current } : result;
        },
      }),
      [agent?.name, agent?.title, fieldNames, schema, setValue, submit],
    ),
  );

  const ctx = useMemo<FormContextValue>(
    () => ({ values, errors, setValue, register, formId, submitting, agentTouched }),
    [values, errors, setValue, register, formId, submitting, agentTouched],
  );

  return (
    <FormContext.Provider value={ctx}>
      <form id={formId} className={className} onSubmit={onFormSubmit} data-agentable-form="" data-agent={agent ? agent.name : undefined} data-submitting={submitting ? "" : undefined} noValidate>
        {children}
        {actions === undefined ? (
          <div data-agentable-form-actions="">
            <button type="submit" disabled={submitting} data-agentable-button="primary">
              {submitLabel}
            </button>
          </div>
        ) : (
          actions
        )}
      </form>
    </FormContext.Provider>
  );
}

function fieldSchema(f: FieldMeta): JSONSchema {
  const s: JSONSchema = {};
  switch (f.type) {
    case "number":
      s.type = "number";
      break;
    case "integer":
      s.type = "integer";
      break;
    case "boolean":
      s.type = "boolean";
      break;
    default:
      s.type = "string";
  }
  if (f.type === "email") s.format = "email";
  if (f.type === "url") s.format = "uri";
  if (f.type === "date") s.format = "date";
  if (f.describe) s.description = f.describe;
  if (f.min !== undefined) s.minimum = f.min;
  if (f.max !== undefined) s.maximum = f.max;
  if (f.minLength !== undefined) s.minLength = f.minLength;
  if (f.maxLength !== undefined) s.maxLength = f.maxLength;
  if (f.pattern) s.pattern = f.pattern;
  if (f.options) s.enum = f.options.map((o) => o.value);
  return s;
}

function coerce(f: FieldMeta, v: unknown): unknown {
  if (f.type === "number" || f.type === "integer") return typeof v === "string" ? Number(v) : v;
  if (f.type === "boolean") return typeof v === "string" ? v === "true" : Boolean(v);
  return v;
}

export interface FieldProps extends Omit<FieldMeta, "name" | "type"> {
  name: string;
  type?: FieldType;
  label?: string;
  placeholder?: string;
  /** Rich description for humans; `describe` is what the agent sees. */
  hint?: ReactNode;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  rows?: number;
}

export function Field({ name, type = "text", label, placeholder, hint, className, describe, required, min, max, minLength, maxLength, pattern, options, agentHidden, autoFocus, disabled, rows }: FieldProps) {
  const form = useFormContext();
  const inputId = `${form.formId}-${name}`;
  const value = form.values[name];
  const error = form.errors[name];
  const touched = form.agentTouched.has(name);

  useEffect(
    () => form.register({ name, type: type === "password" ? "password" : type, describe, required, min, max, minLength, maxLength, pattern, options, agentHidden: agentHidden ?? type === "password" }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.register, name, type, describe, required, min, max, minLength, maxLength, pattern, JSON.stringify(options), agentHidden],
  );

  const common = {
    id: inputId,
    name,
    disabled: disabled || form.submitting,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": hint || error ? `${inputId}-hint` : undefined,
    autoFocus,
    "data-agentable-input": "",
  } as const;

  let control: ReactNode;
  if (type === "boolean") {
    control = <input {...common} type="checkbox" checked={Boolean(value)} onChange={(e) => form.setValue(name, e.target.checked)} />;
  } else if (type === "select" || options) {
    control = (
      <select {...common} value={(value as string) ?? ""} onChange={(e) => form.setValue(name, e.target.value)}>
        <option value="">{placeholder ?? "Select..."}</option>
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label ?? o.value}
          </option>
        ))}
      </select>
    );
  } else if (type === "textarea") {
    control = <textarea {...common} rows={rows ?? 3} placeholder={placeholder} value={(value as string) ?? ""} onChange={(e) => form.setValue(name, e.target.value)} />;
  } else {
    const inputType = type === "integer" ? "number" : type;
    control = (
      <input
        {...common}
        type={inputType}
        placeholder={placeholder}
        min={min}
        max={max}
        step={type === "integer" ? 1 : undefined}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (type === "number" || type === "integer") form.setValue(name, raw === "" ? undefined : Number(raw));
          else form.setValue(name, raw);
        }}
      />
    );
  }

  return (
    <div className={className} data-agentable-field={name} data-type={type} data-invalid={error ? "" : undefined} data-agent-touched={touched ? "" : undefined}>
      {label ? (
        <label htmlFor={inputId} data-agentable-label="">
          {label}
          {required ? <span aria-hidden="true" data-agentable-required=""> *</span> : null}
        </label>
      ) : null}
      {control}
      {error ? (
        <p id={`${inputId}-hint`} role="alert" data-agentable-error="">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} data-agentable-hint="">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
