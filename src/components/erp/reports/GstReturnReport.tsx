"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useFinanceReport } from "@/hooks/useFinance";
import { useGstRegistrations } from "@/hooks/useTaxes";
import { formatMoney, monthRange } from "@/lib/erp";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { Help } from "@/components/erp/finance/Help";
import { neutralise } from "@/lib/csvSafe";

type Rate = {
  rate_bps: number;
  taxable_minor: number;
  cgst_minor: number;
  sgst_minor: number;
  igst_minor: number;
};
type Doc = {
  doc_number: string;
  date: string;
  customer_gstin: string | null;
  customer_name: string | null;
  place_of_supply: string | null;
  supply_type: string;
  taxable_minor: number;
  cgst_minor: number;
  sgst_minor: number;
  igst_minor: number;
  total_minor: number;
  rates: Rate[];
};
type Summary = {
  place_of_supply: string;
  supply_type: string;
  rate_bps: number;
  taxable_minor: number;
  cgst_minor: number;
  sgst_minor: number;
  igst_minor: number;
};
type Hsn = {
  hsn: string | null;
  rate_bps: number;
  quantity: number;
  taxable_minor: number;
  cgst_minor: number;
  sgst_minor: number;
  igst_minor: number;
};
type Gstr1 = {
  b2b: Doc[];
  b2c: Summary[];
  credit_notes_b2b: Doc[];
  credit_notes_b2c: Summary[];
  hsn: Hsn[];
  documents: {
    doc_type: string;
    series: string;
    from: string;
    to: string;
    count: number;
  }[];
};

const th =
  "p-space-2 text-left text-[12px] tracking-wide text-ink-400 uppercase";
const rupees = (minor: number) => (minor / 100).toFixed(2);

function csvDownload(
  name: string,
  header: string[],
  rows: (string | number)[][],
) {
  const cell = (v: string | number) => {
    const s = typeof v === "number" ? String(v) : neutralise(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Outward supplies laid out like a GSTR-1 return (per GSTIN), with CSV downloads for the filing / the CA. */
export function GstReturnReport({ currency }: { currency: string }) {
  const range = monthRange();
  const [from, setFrom] = useState(range.from),
    [to, setTo] = useState(range.to),
    [registration, setRegistration] = useState("");
  const regs = useGstRegistrations();
  const g = useFinanceReport<Gstr1>("gstr1", {
    date_from: from,
    date_to: to,
    registration_id: registration || null,
  });
  const m = (v: number) => formatMoney(v, currency);
  const d = g.data;
  const rate = (bps: number) => `${bps / 100}%`;

  const docRows = (docs: Doc[]) =>
    docs.flatMap((x) =>
      x.rates.map((r) => [
        x.doc_number,
        x.date,
        x.customer_gstin ?? "",
        x.customer_name ?? "",
        x.place_of_supply ?? "",
        rate(r.rate_bps),
        rupees(r.taxable_minor),
        rupees(r.cgst_minor),
        rupees(r.sgst_minor),
        rupees(r.igst_minor),
        rupees(x.total_minor),
      ]),
    );
  const docHeader = [
    "Document",
    "Date",
    "Customer GSTIN",
    "Customer",
    "Place of supply",
    "Rate",
    "Taxable",
    "CGST",
    "SGST",
    "IGST",
    "Document total",
  ];
  const summaryRows = (s: Summary[]) =>
    s.map((r) => [
      r.place_of_supply,
      r.supply_type === "INTER" ? "Inter-state" : "Intra-state",
      rate(r.rate_bps),
      rupees(r.taxable_minor),
      rupees(r.cgst_minor),
      rupees(r.sgst_minor),
      rupees(r.igst_minor),
    ]);
  const summaryHeader = [
    "Place of supply",
    "Supply",
    "Rate",
    "Taxable",
    "CGST",
    "SGST",
    "IGST",
  ];

  const section = (
    title: string,
    hint: string,
    csv: (() => void) | null,
    body: React.ReactNode,
  ) => (
    <Card className="p-space-4">
      <div className="mobile-page-action-row mb-space-2 flex items-start justify-between gap-space-3">
        <div>
          <h3 className="text-[15px] font-bold text-ink-900">
            {title}
            <Help term={title} />
          </h3>
          <p className="text-[12.5px] text-ink-600">{hint}</p>
        </div>
        {csv && (
          <Button
            className="mobile-page-action"
            variant="secondary"
            onClick={csv}
          >
            Download CSV
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">{body}</div>
    </Card>
  );
  const empty = (cols: number) => (
    <tr>
      <td colSpan={cols} className="py-3 text-center text-ink-400">
        Nothing in this period.
      </td>
    </tr>
  );
  const docTable = (docs: Doc[]) => (
    <table className="w-full text-[13.5px]">
      <thead>
        <tr>
          <th className={th}>Document</th>
          <th className={th}>Date</th>
          <th className={th}>Customer GSTIN</th>
          <th className={th}>Place of supply</th>
          <th className={`${th} text-right`}>Taxable</th>
          <th className={`${th} text-right`}>CGST</th>
          <th className={`${th} text-right`}>SGST</th>
          <th className={`${th} text-right`}>IGST</th>
          <th className={`${th} text-right`}>Total</th>
        </tr>
      </thead>
      <tbody>
        {docs.map((x) => (
          <tr key={x.doc_number} className="border-t border-line">
            <td className="py-1.5 font-medium">{x.doc_number}</td>
            <td>{x.date}</td>
            <td>{x.customer_gstin}</td>
            <td>{x.place_of_supply}</td>
            <td className="text-right tabular-nums">{m(x.taxable_minor)}</td>
            <td className="text-right tabular-nums">{m(x.cgst_minor)}</td>
            <td className="text-right tabular-nums">{m(x.sgst_minor)}</td>
            <td className="text-right tabular-nums">{m(x.igst_minor)}</td>
            <td className="text-right tabular-nums">{m(x.total_minor)}</td>
          </tr>
        ))}
        {docs.length === 0 && empty(9)}
      </tbody>
    </table>
  );
  const summaryTable = (rows: Summary[]) => (
    <table className="w-full text-[13.5px]">
      <thead>
        <tr>
          <th className={th}>Place of supply</th>
          <th className={th}>Supply</th>
          <th className={th}>Rate</th>
          <th className={`${th} text-right`}>Taxable</th>
          <th className={`${th} text-right`}>CGST</th>
          <th className={`${th} text-right`}>SGST</th>
          <th className={`${th} text-right`}>IGST</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-line">
            <td className="py-1.5">{r.place_of_supply || "—"}</td>
            <td>{r.supply_type === "INTER" ? "Inter-state" : "Intra-state"}</td>
            <td>{rate(r.rate_bps)}</td>
            <td className="text-right tabular-nums">{m(r.taxable_minor)}</td>
            <td className="text-right tabular-nums">{m(r.cgst_minor)}</td>
            <td className="text-right tabular-nums">{m(r.sgst_minor)}</td>
            <td className="text-right tabular-nums">{m(r.igst_minor)}</td>
          </tr>
        ))}
        {rows.length === 0 && empty(7)}
      </tbody>
    </table>
  );

  return (
    <>
      <div className="mb-space-4 flex flex-wrap items-end gap-space-3">
        <Field label="From" htmlFor="g1_from" className="!mb-0">
          <Input
            id="g1_from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-44"
          />
        </Field>
        <Field label="To" htmlFor="g1_to" className="!mb-0">
          <Input
            id="g1_to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-44"
          />
        </Field>
        <Field label="GST registration" htmlFor="g1_reg" className="!mb-0">
          <Select
            id="g1_reg"
            value={registration}
            onValueChange={(value) => setRegistration(value)}
            className="w-64"
          >
            <option value="">All registrations</option>
            {(regs.data?.registrations ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.gstin} — {r.state_name ?? r.state_code}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="mb-space-3 text-[12.5px] text-ink-400">
        Returns are filed per GSTIN, so pick one registration to get a
        return&apos;s figures. Credit notes are shown as negatives. These are
        working tables and CSV exports, not the GST portal&apos;s own upload
        format.
      </p>
      {g.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {g.error.message}
        </p>
      )}
      {!d && !g.error && (
        <div className="flex flex-col gap-space-4">
          <CardSkeleton rows={4} />
          <CardSkeleton rows={4} />
        </div>
      )}
      {d && (
        <div className="flex flex-col gap-space-4">
          {section(
            "B2B invoices",
            "Sales to buyers with a GSTIN, listed one by one.",
            () => csvDownload("gstr1-b2b.csv", docHeader, docRows(d.b2b)),
            docTable(d.b2b),
          )}
          {section(
            "B2C sales",
            "Sales to consumers, summarised by place of supply and rate.",
            () =>
              csvDownload("gstr1-b2c.csv", summaryHeader, summaryRows(d.b2c)),
            summaryTable(d.b2c),
          )}
          {section(
            "Credit notes: registered buyers",
            "Returns against B2B invoices.",
            () =>
              csvDownload(
                "gstr1-credit-notes-b2b.csv",
                docHeader,
                docRows(d.credit_notes_b2b),
              ),
            docTable(d.credit_notes_b2b),
          )}
          {section(
            "Credit notes: consumers",
            "Returns against B2C sales, by place of supply and rate.",
            () =>
              csvDownload(
                "gstr1-credit-notes-b2c.csv",
                summaryHeader,
                summaryRows(d.credit_notes_b2c),
              ),
            summaryTable(d.credit_notes_b2c),
          )}
          {section(
            "HSN summary",
            "Quantity and value by HSN code and rate, net of returns.",
            () =>
              csvDownload(
                "gstr1-hsn.csv",
                ["HSN", "Rate", "Quantity", "Taxable", "CGST", "SGST", "IGST"],
                d.hsn.map((h) => [
                  h.hsn ?? "",
                  rate(h.rate_bps),
                  h.quantity,
                  rupees(h.taxable_minor),
                  rupees(h.cgst_minor),
                  rupees(h.sgst_minor),
                  rupees(h.igst_minor),
                ]),
              ),
            <table className="w-full text-[13.5px]">
              <thead>
                <tr>
                  <th className={th}>HSN</th>
                  <th className={th}>Rate</th>
                  <th className={`${th} text-right`}>Qty</th>
                  <th className={`${th} text-right`}>Taxable</th>
                  <th className={`${th} text-right`}>CGST</th>
                  <th className={`${th} text-right`}>SGST</th>
                  <th className={`${th} text-right`}>IGST</th>
                </tr>
              </thead>
              <tbody>
                {d.hsn.map((h, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-1.5">
                      {h.hsn ?? <span className="text-ink-400">Not set</span>}
                    </td>
                    <td>{rate(h.rate_bps)}</td>
                    <td className="text-right tabular-nums">{h.quantity}</td>
                    <td className="text-right tabular-nums">
                      {m(h.taxable_minor)}
                    </td>
                    <td className="text-right tabular-nums">
                      {m(h.cgst_minor)}
                    </td>
                    <td className="text-right tabular-nums">
                      {m(h.sgst_minor)}
                    </td>
                    <td className="text-right tabular-nums">
                      {m(h.igst_minor)}
                    </td>
                  </tr>
                ))}
                {d.hsn.length === 0 && empty(7)}
              </tbody>
            </table>,
          )}
          {section(
            "Documents issued",
            "Number ranges for the period.",
            null,
            <table className="w-full text-[13.5px]">
              <thead>
                <tr>
                  <th className={th}>Type</th>
                  <th className={th}>Series</th>
                  <th className={th}>From</th>
                  <th className={th}>To</th>
                  <th className={`${th} text-right`}>Count</th>
                </tr>
              </thead>
              <tbody>
                {d.documents.map((x) => (
                  <tr
                    key={`${x.doc_type}:${x.series}`}
                    className="border-t border-line"
                  >
                    <td className="py-1.5">
                      {x.doc_type === "INVOICE" ? "Invoices" : "Credit notes"}
                    </td>
                    <td>{x.series}</td>
                    <td>{x.from}</td>
                    <td>{x.to}</td>
                    <td className="text-right tabular-nums">{x.count}</td>
                  </tr>
                ))}
                {d.documents.length === 0 && empty(5)}
              </tbody>
            </table>,
          )}
        </div>
      )}
    </>
  );
}
