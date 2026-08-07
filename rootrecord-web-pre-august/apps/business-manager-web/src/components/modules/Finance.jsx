import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "../../lib/api";
import { ScreenHeader, PageContainer, Section, Field, Empty, Toast, useToast, Spinner } from "../ui/Shell";
import { EntitySelectWithNew } from "../ui/EntitySelectWithNew";
import { fmtMoney, fmtDateShort, toDatetimeLocalInput } from "../../lib/format";
import { Plus, Trash2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { FullSheet } from "../ui/FullSheet";

const TABS = [
  { id: "money", label: "Money" },
  { id: "clients", label: "Clients" },
  { id: "invoices", label: "Invoices" },
  { id: "debts", label: "Debts" },
  { id: "funds", label: "Funds" },
  { id: "scheduled", label: "Scheduled" },
  { id: "resources", label: "Resources" },
  { id: "tax", label: "Tax" },
];

export default function Finance() {
  const { guest } = useAuth();
  const [tab, setTab] = useState("money");
  return (
    <>
      <ScreenHeader title="Finance & Clients" subtitle="Money, clients, invoices, debts, funds, more" back={false} />
      <PageContainer>
        <div
          className="card p-1 flex overflow-x-auto no-scrollbar mb-4 sticky z-10"
          style={{ top: "3.25rem" }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              data-testid={`finance-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors min-h-[40px] ${
                tab === t.id ? "bg-bg-elevated text-ink-primary" : "text-ink-tertiary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {guest ? (
          <Empty title="Sign in to manage your money & clients" />
        ) : (
          <>
            {tab === "money" && <MoneyTab />}
            {tab === "clients" && <ClientsTab />}
            {tab === "invoices" && <InvoicesTab />}
            {tab === "debts" && <DebtsTab />}
            {tab === "funds" && <FundsTab />}
            {tab === "scheduled" && <ScheduledTab />}
            {tab === "resources" && <ResourcesTab />}
            {tab === "tax" && <TaxTab />}
          </>
        )}
      </PageContainer>
    </>
  );
}

// ------------ Money (income / expenses) ------------
function MoneyTab() {
  const { toast, show, clear } = useToast();
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  // form
  const [iAmount, setIAmount] = useState("");
  const [iDesc, setIDesc] = useState("");
  const [eAmount, setEAmount] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eFunding, setEFunding] = useState("cash");
  const [editMoney, setEditMoney] = useState(null);
  const [mAmt, setMAmt] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [mWhen, setMWhen] = useState("");
  const [mFunding, setMFunding] = useState("cash");
  const [mSaving, setMSaving] = useState(false);

  useEffect(() => {
    if (!editMoney) return;
    const r = editMoney.row;
    if (editMoney.kind === "income") {
      setMAmt(((r.amount_cents || 0) / 100).toFixed(2));
      setMDesc(r.description || "");
      setMWhen(toDatetimeLocalInput(r.received_at_utc));
    } else {
      setMAmt(((r.amount_cents || 0) / 100).toFixed(2));
      setMDesc(r.description || "");
      setMWhen(toDatetimeLocalInput(r.spent_at_utc));
      setMFunding(r.funding || "cash");
    }
  }, [editMoney]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: i }, { data: e }] = await Promise.all([
        api.get("/money/income"),
        api.get("/money/expenses"),
      ]);
      setIncome(i); setExpenses(e);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function addIncome(ev) {
    ev.preventDefault();
    const cents = Math.round(parseFloat(iAmount || "0") * 100);
    if (!cents) return show("Enter an amount", "error");
    await api.post("/money/income", { amount_cents: cents, description: iDesc, currency: "USD" });
    setIAmount(""); setIDesc(""); show("Income added", "success"); load();
  }
  async function addExpense(ev) {
    ev.preventDefault();
    const cents = Math.round(parseFloat(eAmount || "0") * 100);
    if (!cents) return show("Enter an amount", "error");
    await api.post("/money/expenses", { amount_cents: cents, description: eDesc, funding: eFunding, currency: "USD" });
    setEAmount(""); setEDesc(""); show("Expense added", "success"); load();
  }
  async function delI(id) {
    await api.delete(`/money/income/${id}`);
    load();
  }
  async function delE(id) {
    await api.delete(`/money/expenses/${id}`);
    load();
  }

  async function saveMoneyEdit(e) {
    e.preventDefault();
    if (!editMoney) return;
    const cents = Math.round(parseFloat(mAmt || "0") * 100);
    if (!cents) return show("Enter an amount", "error");
    setMSaving(true);
    try {
      if (editMoney.kind === "income") {
        await api.patch(`/money/income/${editMoney.row.id}`, {
          amount_cents: cents,
          description: mDesc,
          received_at_utc: new Date(mWhen).toISOString(),
          currency: editMoney.row.currency || "USD",
        });
      } else {
        await api.patch(`/money/expenses/${editMoney.row.id}`, {
          amount_cents: cents,
          description: mDesc,
          spent_at_utc: new Date(mWhen).toISOString(),
          funding: mFunding,
          currency: editMoney.row.currency || "USD",
        });
      }
      show("Saved", "success");
      setEditMoney(null);
      load();
    } catch (err) {
      show(formatApiError(err), "error");
    } finally {
      setMSaving(false);
    }
  }

  return (
    <>
      <Section title="Add income">
        <form onSubmit={addIncome} className="p-4">
          <Field label="Amount (USD)">
            <input data-testid="income-amount" className="input" type="number" step="0.01" inputMode="decimal" value={iAmount} onChange={(e) => setIAmount(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Description">
            <input data-testid="income-desc" className="input" value={iDesc} onChange={(e) => setIDesc(e.target.value)} placeholder="Project payment, refund, etc." />
          </Field>
          <button data-testid="income-add-btn" className="btn btn-primary w-full"><Plus size={16} /> Add income</button>
        </form>
      </Section>
      <Section title="Add expense">
        <form onSubmit={addExpense} className="p-4">
          <Field label="Amount (USD)">
            <input data-testid="expense-amount" className="input" type="number" step="0.01" inputMode="decimal" value={eAmount} onChange={(e) => setEAmount(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Funding">
            <select data-testid="expense-funding" className="input" value={eFunding} onChange={(e) => setEFunding(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="credit">Credit</option>
            </select>
          </Field>
          <Field label="Description">
            <input data-testid="expense-desc" className="input" value={eDesc} onChange={(e) => setEDesc(e.target.value)} placeholder="Software, supplies, fuel…" />
          </Field>
          <button data-testid="expense-add-btn" className="btn btn-primary w-full"><Plus size={16} /> Add expense</button>
        </form>
      </Section>

      {loading ? <Spinner /> : (
        <>
          <Section title={`Income (${income.length})`}>
            {income.length === 0 ? <p className="p-4 text-sm text-ink-tertiary">No income yet.</p> :
              income.map((i) => (
                <div key={i.id} data-testid={`income-row-${i.id}`} className="row">
                  <button
                    type="button"
                    className="flex items-center gap-3 min-w-0 flex-1 text-left border-0 bg-transparent cursor-pointer p-0"
                    onClick={() => setEditMoney({ kind: "income", row: i })}
                  >
                    <ArrowDownLeft size={18} className="text-income flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{i.description || "Income"}</p>
                      <p className="text-xs text-ink-tertiary">{fmtDateShort(i.received_at_utc)}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-income font-semibold">{fmtMoney(i.amount_cents, i.currency)}</span>
                    <button type="button" onClick={() => delI(i.id)} className="btn btn-ghost p-2 text-ink-tertiary">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            }
          </Section>
          <Section title={`Expenses (${expenses.length})`}>
            {expenses.length === 0 ? <p className="p-4 text-sm text-ink-tertiary">No expenses yet.</p> :
              expenses.map((x) => (
                <div key={x.id} data-testid={`expense-row-${x.id}`} className="row">
                  <button
                    type="button"
                    className="flex items-center gap-3 min-w-0 flex-1 text-left border-0 bg-transparent cursor-pointer p-0"
                    onClick={() => setEditMoney({ kind: "expense", row: x })}
                  >
                    <ArrowUpRight size={18} className="text-expense flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{x.description || "Expense"}</p>
                      <p className="text-xs text-ink-tertiary">
                        {fmtDateShort(x.spent_at_utc)} · {x.funding}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-expense font-semibold">{fmtMoney(x.amount_cents, x.currency)}</span>
                    <button type="button" onClick={() => delE(x.id)} className="btn btn-ghost p-2 text-ink-tertiary">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            }
          </Section>
        </>
      )}
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
      <FullSheet
        open={Boolean(editMoney)}
        title={editMoney?.kind === "income" ? "Edit income" : "Edit expense"}
        onClose={() => setEditMoney(null)}
      >
        {editMoney && (
          <form onSubmit={saveMoneyEdit}>
            <Field label="Amount (USD)">
              <input className="input" type="number" step="0.01" inputMode="decimal" value={mAmt} onChange={(e) => setMAmt(e.target.value)} data-testid="edit-money-amount" />
            </Field>
            <Field label={editMoney.kind === "income" ? "Received" : "Spent"}>
              <input className="input" type="datetime-local" value={mWhen} onChange={(e) => setMWhen(e.target.value)} data-testid="edit-money-when" />
            </Field>
            {editMoney.kind === "expense" && (
              <Field label="Funding">
                <select className="input" value={mFunding} onChange={(e) => setMFunding(e.target.value)} data-testid="edit-money-funding">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="credit">Credit</option>
                </select>
              </Field>
            )}
            <Field label="Description">
              <input className="input" value={mDesc} onChange={(e) => setMDesc(e.target.value)} data-testid="edit-money-desc" />
            </Field>
            <button type="submit" className="btn btn-primary w-full" disabled={mSaving} data-testid="edit-money-save">
              {mSaving ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </FullSheet>
    </>
  );
}

// ------------ Clients ------------
function ClientsTab() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const { toast, show, clear } = useToast();
  const [editC, setEditC] = useState(null);
  const [ecName, setEcName] = useState("");
  const [ecEmail, setEcEmail] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecSaving, setEcSaving] = useState(false);

  async function load() {
    const { data } = await api.get("/clients");
    setItems(data);
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!editC) return;
    setEcName(editC.display_name || "");
    setEcEmail(editC.email || "");
    setEcPhone(editC.phone || "");
  }, [editC]);

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return show("Name required", "error");
    await api.post("/clients", { display_name: name.trim(), email, phone });
    setName("");
    setEmail("");
    setPhone("");
    load();
    show("Client added", "success");
  }
  async function del(id) {
    await api.delete(`/clients/${id}`);
    load();
  }

  async function saveClientEdit(e) {
    e.preventDefault();
    if (!editC || !ecName.trim()) return show("Name required", "error");
    setEcSaving(true);
    try {
      await api.patch(`/clients/${editC.id}`, {
        display_name: ecName.trim(),
        email: ecEmail,
        phone: ecPhone,
      });
      show("Client updated", "success");
      setEditC(null);
      load();
    } catch (err) {
      show(formatApiError(err), "error");
    } finally {
      setEcSaving(false);
    }
  }

  return (
    <>
      <Section title="Add client">
        <form onSubmit={add} className="p-4">
          <Field label="Name"><input data-testid="client-name" className="input" value={name} onChange={(e)=>setName(e.target.value)} /></Field>
          <Field label="Email"><input data-testid="client-email" className="input" value={email} onChange={(e)=>setEmail(e.target.value)} /></Field>
          <Field label="Phone"><input data-testid="client-phone" className="input" value={phone} onChange={(e)=>setPhone(e.target.value)} /></Field>
          <button data-testid="client-add-btn" className="btn btn-primary w-full"><Plus size={16} /> Add client</button>
        </form>
      </Section>
      <Section title={`Clients (${items.length})`}>
        {items.length === 0 ? <p className="p-4 text-sm text-ink-tertiary">No clients yet.</p> :
          items.map((c) => (
            <div key={c.id} data-testid={`client-row-${c.id}`} className="row">
              <button
                type="button"
                className="min-w-0 flex-1 text-left border-0 bg-transparent cursor-pointer p-0"
                onClick={() => setEditC(c)}
              >
                <p className="text-sm truncate">{c.display_name}</p>
                <p className="text-xs text-ink-tertiary truncate">{c.email || c.phone || "—"}</p>
              </button>
              <button type="button" onClick={() => del(c.id)} className="btn btn-ghost p-2 text-ink-tertiary">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
      </Section>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
      <FullSheet open={Boolean(editC)} title="Edit client" onClose={() => setEditC(null)}>
        {editC && (
          <form onSubmit={saveClientEdit}>
            <Field label="Name">
              <input className="input" value={ecName} onChange={(e) => setEcName(e.target.value)} data-testid="edit-client-name" />
            </Field>
            <Field label="Email">
              <input className="input" value={ecEmail} onChange={(e) => setEcEmail(e.target.value)} data-testid="edit-client-email" />
            </Field>
            <Field label="Phone">
              <input className="input" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} data-testid="edit-client-phone" />
            </Field>
            <button type="submit" className="btn btn-primary w-full" disabled={ecSaving} data-testid="edit-client-save">
              {ecSaving ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </FullSheet>
    </>
  );
}

// ------------ Invoices ------------
function InvoicesTab() {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [number, setNumber] = useState("");
  const [clientId, setClientId] = useState("");
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const { toast, show, clear } = useToast();
  const [editIv, setEditIv] = useState(null);
  const [ivNum, setIvNum] = useState("");
  const [ivStatus, setIvStatus] = useState("");
  const [ivClient, setIvClient] = useState("");
  const [ivSaving, setIvSaving] = useState(false);

  async function load() {
    const [a, b] = await Promise.all([api.get("/invoices"), api.get("/clients")]);
    setItems(a.data);
    setClients(b.data);
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!editIv) return;
    setIvNum(editIv.invoice_number || "");
    setIvStatus(editIv.status || "draft");
    setIvClient(editIv.client_id || "");
  }, [editIv]);

  async function add(e) {
    e.preventDefault();
    if (!number.trim()) return show("Invoice # required", "error");
    const cents = Math.round(parseFloat(price || "0") * 100);
    const lines = cents > 0 ? [{ description: desc, quantity: parseFloat(qty || "1"), unit_price_cents: cents }] : [];
    await api.post("/invoices", { invoice_number: number, client_id: clientId || null, lines });
    setNumber("");
    setClientId("");
    setDesc("");
    setPrice("");
    setQty("1");
    load();
    show("Invoice created", "success");
  }
  async function del(id) {
    await api.delete(`/invoices/${id}`);
    load();
  }

  async function saveInvoiceEdit(e) {
    e.preventDefault();
    if (!editIv || !ivNum.trim()) return show("Invoice # required", "error");
    setIvSaving(true);
    try {
      await api.patch(`/invoices/${editIv.id}`, {
        invoice_number: ivNum.trim(),
        status: ivStatus || "draft",
        client_id: ivClient || null,
      });
      show("Invoice updated", "success");
      setEditIv(null);
      load();
    } catch (err) {
      show(formatApiError(err), "error");
    } finally {
      setIvSaving(false);
    }
  }

  return (
    <>
      <Section title="New invoice">
        <form onSubmit={add} className="p-4">
          <Field label="Invoice #"><input data-testid="invoice-number" className="input" value={number} onChange={(e)=>setNumber(e.target.value)} placeholder="INV-001" /></Field>
          <Field label="Client">
            <EntitySelectWithNew
              entityType="client"
              value={clientId}
              onChange={setClientId}
              items={clients}
              allowEmpty
              emptyLabel="—"
              dataTestId="invoice-client"
              onRefresh={load}
            />
          </Field>
          <Field label="Line description"><input data-testid="invoice-desc" className="input" value={desc} onChange={(e)=>setDesc(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="label">Qty</span>
              <input data-testid="invoice-qty" className="input" type="number" step="0.01" value={qty} onChange={(e)=>setQty(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Unit price</span>
              <input data-testid="invoice-price" className="input" type="number" step="0.01" value={price} onChange={(e)=>setPrice(e.target.value)} placeholder="0.00" />
            </label>
          </div>
          <button data-testid="invoice-add-btn" className="btn btn-primary w-full"><Plus size={16} /> Save invoice</button>
        </form>
      </Section>
      <Section title={`Invoices (${items.length})`}>
        {items.length === 0 ? <p className="p-4 text-sm text-ink-tertiary">No invoices yet.</p> :
          items.map((i) => (
            <div key={i.id} className="row">
              <button
                type="button"
                className="min-w-0 flex-1 text-left border-0 bg-transparent cursor-pointer p-0"
                onClick={() => setEditIv(i)}
              >
                <p className="text-sm truncate font-semibold">{i.invoice_number}</p>
                <p className="text-xs text-ink-tertiary">
                  {i.status} · {fmtDateShort(i.issued_at_utc)}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{fmtMoney(i.total_cents, i.currency)}</span>
                <button type="button" onClick={() => del(i.id)} className="btn btn-ghost p-2 text-ink-tertiary">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
      </Section>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
      <FullSheet open={Boolean(editIv)} title="Edit invoice" onClose={() => setEditIv(null)}>
        {editIv && (
          <form onSubmit={saveInvoiceEdit}>
            <Field label="Invoice #">
              <input className="input" value={ivNum} onChange={(e) => setIvNum(e.target.value)} data-testid="edit-invoice-number" />
            </Field>
            <Field label="Status">
              <select className="input" value={ivStatus} onChange={(e) => setIvStatus(e.target.value)} data-testid="edit-invoice-status">
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="void">Void</option>
              </select>
            </Field>
            <Field label="Client">
              <EntitySelectWithNew
                entityType="client"
                value={ivClient}
                onChange={setIvClient}
                items={clients}
                allowEmpty
                emptyLabel="—"
                dataTestId="edit-invoice-client"
                onRefresh={load}
              />
            </Field>
            <p className="text-xs text-ink-tertiary mb-3">Line items are unchanged here; totals follow saved lines.</p>
            <button type="submit" className="btn btn-primary w-full" disabled={ivSaving} data-testid="edit-invoice-save">
              {ivSaving ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </FullSheet>
    </>
  );
}

// ------------ Debts ------------
function DebtsTab() {
  const [items, setItems] = useState([]);
  const [amount, setAmount] = useState("");
  const [creditor, setCreditor] = useState("");
  const [desc, setDesc] = useState("");
  const { toast, show, clear } = useToast();
  const [editD, setEditD] = useState(null);
  const [dAmt, setDAmt] = useState("");
  const [dCred, setDCred] = useState("");
  const [dDesc, setDDesc] = useState("");
  const [dStatus, setDStatus] = useState("");
  const [dSaving, setDSaving] = useState(false);

  async function load() {
    const { data } = await api.get("/debts");
    setItems(data);
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!editD) return;
    setDAmt(((editD.amount_cents || 0) / 100).toFixed(2));
    setDCred(editD.creditor || "");
    setDDesc(editD.description || "");
    setDStatus(editD.status || "open");
  }, [editD]);

  async function add(e) {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount || "0") * 100);
    if (!cents) return;
    await api.post("/debts", { amount_cents: cents, creditor, description: desc });
    setAmount("");
    setCreditor("");
    setDesc("");
    load();
  }
  async function del(id) {
    await api.delete(`/debts/${id}`);
    load();
  }

  async function saveDebtEdit(e) {
    e.preventDefault();
    if (!editD) return;
    const cents = Math.round(parseFloat(dAmt || "0") * 100);
    if (!cents) return show("Enter an amount", "error");
    setDSaving(true);
    try {
      await api.patch(`/debts/${editD.id}`, {
        amount_cents: cents,
        creditor: dCred,
        description: dDesc,
        status: dStatus,
      });
      show("Debt updated", "success");
      setEditD(null);
      load();
    } catch (err) {
      show(formatApiError(err), "error");
    } finally {
      setDSaving(false);
    }
  }

  return (
    <>
      <Section title="Track a debt">
        <form onSubmit={add} className="p-4">
          <Field label="Amount"><input data-testid="debt-amount" className="input" type="number" step="0.01" value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0.00" /></Field>
          <Field label="Creditor"><input data-testid="debt-creditor" className="input" value={creditor} onChange={(e)=>setCreditor(e.target.value)} placeholder="Bank / vendor" /></Field>
          <Field label="Description"><input data-testid="debt-desc" className="input" value={desc} onChange={(e)=>setDesc(e.target.value)} /></Field>
          <button data-testid="debt-add-btn" className="btn btn-primary w-full"><Plus size={16} /> Save debt</button>
        </form>
      </Section>
      <Section title={`Debts (${items.length})`}>
        {items.length === 0 ? <p className="p-4 text-sm text-ink-tertiary">No debts tracked.</p> :
          items.map((d) => (
            <div key={d.id} className="row">
              <button
                type="button"
                className="min-w-0 flex-1 text-left border-0 bg-transparent cursor-pointer p-0"
                onClick={() => setEditD(d)}
              >
                <p className="text-sm truncate">
                  {d.creditor || "Creditor"} · {d.description}
                </p>
                <p className="text-xs text-ink-tertiary">{d.status}</p>
              </button>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-expense">{fmtMoney(d.amount_cents, d.currency)}</span>
                <button type="button" onClick={() => del(d.id)} className="btn btn-ghost p-2 text-ink-tertiary">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
      </Section>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
      <FullSheet open={Boolean(editD)} title="Edit debt" onClose={() => setEditD(null)}>
        {editD && (
          <form onSubmit={saveDebtEdit}>
            <Field label="Amount">
              <input className="input" type="number" step="0.01" value={dAmt} onChange={(e) => setDAmt(e.target.value)} />
            </Field>
            <Field label="Creditor">
              <input className="input" value={dCred} onChange={(e) => setDCred(e.target.value)} />
            </Field>
            <Field label="Description">
              <input className="input" value={dDesc} onChange={(e) => setDDesc(e.target.value)} />
            </Field>
            <Field label="Status">
              <input className="input" value={dStatus} onChange={(e) => setDStatus(e.target.value)} placeholder="open / closed" />
            </Field>
            <button type="submit" className="btn btn-primary w-full" disabled={dSaving}>
              {dSaving ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </FullSheet>
    </>
  );
}

// ------------ Funds (accounts) ------------
function FundsTab() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("cash");
  const [bal, setBal] = useState("");
  const { toast, show, clear } = useToast();
  const [editF, setEditF] = useState(null);
  const [fName, setFName] = useState("");
  const [fType, setFType] = useState("cash");
  const [fBal, setFBal] = useState("");
  const [fSaving, setFSaving] = useState(false);

  async function load() {
    const { data } = await api.get("/funds");
    setItems(data);
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!editF) return;
    setFName(editF.account_name || "");
    setFType(editF.account_type || "cash");
    setFBal(((editF.current_balance_cents || 0) / 100).toFixed(2));
  }, [editF]);

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return show("Name required", "error");
    await api.post("/funds", {
      account_name: name,
      account_type: type,
      current_balance_cents: Math.round(parseFloat(bal || "0") * 100),
    });
    setName("");
    setBal("");
    load();
  }
  async function del(id) {
    await api.delete(`/funds/${id}`);
    load();
  }

  async function saveFundEdit(e) {
    e.preventDefault();
    if (!editF || !fName.trim()) return show("Name required", "error");
    setFSaving(true);
    try {
      await api.patch(`/funds/${editF.id}`, {
        account_name: fName.trim(),
        account_type: fType,
        current_balance_cents: Math.round(parseFloat(fBal || "0") * 100),
      });
      show("Account updated", "success");
      setEditF(null);
      load();
    } catch (err) {
      show(formatApiError(err), "error");
    } finally {
      setFSaving(false);
    }
  }

  const total = useMemo(() => items.reduce((s, i) => s + (i.current_balance_cents || 0), 0), [items]);
  return (
    <>
      <Section title="Add account">
        <form onSubmit={add} className="p-4">
          <Field label="Account name"><input data-testid="fund-name" className="input" value={name} onChange={(e)=>setName(e.target.value)} /></Field>
          <Field label="Type">
            <select data-testid="fund-type" className="input" value={type} onChange={(e)=>setType(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="credit">Credit</option>
            </select>
          </Field>
          <Field label="Current balance"><input data-testid="fund-balance" className="input" type="number" step="0.01" value={bal} onChange={(e)=>setBal(e.target.value)} placeholder="0.00" /></Field>
          <button data-testid="fund-add-btn" className="btn btn-primary w-full"><Plus size={16} /> Save account</button>
        </form>
      </Section>
      <div className="card p-3 mb-3 flex justify-between">
        <span className="text-sm text-ink-secondary">Total available</span>
        <span className="font-heading font-bold text-brand">{fmtMoney(total)}</span>
      </div>
      <Section title={`Accounts (${items.length})`}>
        {items.length === 0 ? <p className="p-4 text-sm text-ink-tertiary">No accounts yet.</p> :
          items.map((f) => (
            <div key={f.id} className="row">
              <button
                type="button"
                className="min-w-0 flex-1 text-left border-0 bg-transparent cursor-pointer p-0"
                onClick={() => setEditF(f)}
              >
                <p className="text-sm truncate">{f.account_name}</p>
                <p className="text-xs text-ink-tertiary">{f.account_type}</p>
              </button>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{fmtMoney(f.current_balance_cents, f.currency)}</span>
                <button type="button" onClick={() => del(f.id)} className="btn btn-ghost p-2 text-ink-tertiary">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
      </Section>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
      <FullSheet open={Boolean(editF)} title="Edit account" onClose={() => setEditF(null)}>
        {editF && (
          <form onSubmit={saveFundEdit}>
            <Field label="Account name">
              <input className="input" value={fName} onChange={(e) => setFName(e.target.value)} />
            </Field>
            <Field label="Type">
              <select className="input" value={fType} onChange={(e) => setFType(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="credit">Credit</option>
              </select>
            </Field>
            <Field label="Current balance">
              <input className="input" type="number" step="0.01" value={fBal} onChange={(e) => setFBal(e.target.value)} />
            </Field>
            <button type="submit" className="btn btn-primary w-full" disabled={fSaving}>
              {fSaving ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </FullSheet>
    </>
  );
}

// ------------ Scheduled (recurring) ------------
function ScheduledTab() {
  const [items, setItems] = useState([]);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [freq, setFreq] = useState("monthly");
  const [next, setNext] = useState("");
  const { toast, show, clear } = useToast();
  const [editS, setEditS] = useState(null);
  const [sDesc, setSDesc] = useState("");
  const [sAmt, setSAmt] = useState("");
  const [sFreq, setSFreq] = useState("monthly");
  const [sNext, setSNext] = useState("");
  const [sSaving, setSSaving] = useState(false);

  async function load() {
    const { data } = await api.get("/scheduled-expenses");
    setItems(data);
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!editS) return;
    setSDesc(editS.description || "");
    setSAmt(((editS.amount_cents || 0) / 100).toFixed(2));
    setSFreq(editS.frequency || "monthly");
    setSNext(toDatetimeLocalInput(editS.next_due_utc));
  }, [editS]);

  async function add(e) {
    e.preventDefault();
    if (!desc.trim() || !amount || !next) return show("Fill description, amount, and next due", "error");
    await api.post("/scheduled-expenses", {
      description: desc,
      amount_cents: Math.round(parseFloat(amount) * 100),
      frequency: freq,
      next_due_utc: new Date(next).toISOString(),
    });
    setDesc("");
    setAmount("");
    setNext("");
    load();
  }
  async function del(id) {
    await api.delete(`/scheduled-expenses/${id}`);
    load();
  }

  async function saveSchedEdit(e) {
    e.preventDefault();
    if (!editS || !sDesc.trim() || !sAmt || !sNext) return show("Fill description, amount, and next due", "error");
    setSSaving(true);
    try {
      await api.patch(`/scheduled-expenses/${editS.id}`, {
        description: sDesc.trim(),
        amount_cents: Math.round(parseFloat(sAmt) * 100),
        frequency: sFreq,
        next_due_utc: new Date(sNext).toISOString(),
      });
      show("Scheduled expense updated", "success");
      setEditS(null);
      load();
    } catch (err) {
      show(formatApiError(err), "error");
    } finally {
      setSSaving(false);
    }
  }

  return (
    <>
      <Section title="Add recurring expense">
        <form onSubmit={add} className="p-4">
          <Field label="Description"><input data-testid="sched-desc" className="input" value={desc} onChange={(e)=>setDesc(e.target.value)} /></Field>
          <Field label="Amount"><input data-testid="sched-amount" className="input" type="number" step="0.01" value={amount} onChange={(e)=>setAmount(e.target.value)} /></Field>
          <Field label="Frequency">
            <select data-testid="sched-freq" className="input" value={freq} onChange={(e)=>setFreq(e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>
          <Field label="Next due"><input data-testid="sched-next" className="input" type="datetime-local" value={next} onChange={(e)=>setNext(e.target.value)} /></Field>
          <button data-testid="sched-add-btn" className="btn btn-primary w-full"><Plus size={16} /> Save</button>
        </form>
      </Section>
      <Section title={`Scheduled (${items.length})`}>
        {items.length === 0 ? <p className="p-4 text-sm text-ink-tertiary">No scheduled expenses.</p> :
          items.map((s) => (
            <div key={s.id} className="row">
              <button
                type="button"
                className="min-w-0 flex-1 text-left border-0 bg-transparent cursor-pointer p-0"
                onClick={() => setEditS(s)}
              >
                <p className="text-sm truncate">{s.description}</p>
                <p className="text-xs text-ink-tertiary">
                  {s.frequency} · next {fmtDateShort(s.next_due_utc)}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{fmtMoney(s.amount_cents, s.currency)}</span>
                <button type="button" onClick={() => del(s.id)} className="btn btn-ghost p-2 text-ink-tertiary">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
      </Section>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
      <FullSheet open={Boolean(editS)} title="Edit scheduled expense" onClose={() => setEditS(null)}>
        {editS && (
          <form onSubmit={saveSchedEdit}>
            <Field label="Description">
              <input className="input" value={sDesc} onChange={(e) => setSDesc(e.target.value)} />
            </Field>
            <Field label="Amount">
              <input className="input" type="number" step="0.01" value={sAmt} onChange={(e) => setSAmt(e.target.value)} />
            </Field>
            <Field label="Frequency">
              <select className="input" value={sFreq} onChange={(e) => setSFreq(e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </Field>
            <Field label="Next due">
              <input className="input" type="datetime-local" value={sNext} onChange={(e) => setSNext(e.target.value)} />
            </Field>
            <button type="submit" className="btn btn-primary w-full" disabled={sSaving}>
              {sSaving ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </FullSheet>
    </>
  );
}

// ------------ Resources (owner contributions) ------------
function ResourcesTab() {
  const [items, setItems] = useState([]);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [src, setSrc] = useState("owner_contribution");
  const { toast, show, clear } = useToast();
  const [editR, setEditR] = useState(null);
  const [rAmt, setRAmt] = useState("");
  const [rDesc, setRDesc] = useState("");
  const [rSrc, setRSrc] = useState("owner_contribution");
  const [rWhen, setRWhen] = useState("");
  const [rSaving, setRSaving] = useState(false);

  async function load() {
    const { data } = await api.get("/resources");
    setItems(data);
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!editR) return;
    setRAmt(((editR.amount_cents || 0) / 100).toFixed(2));
    setRDesc(editR.description || "");
    setRSrc(editR.source_type || "owner_contribution");
    const w = editR.at_utc || editR.recorded_at_utc || editR.created_at;
    setRWhen(w ? toDatetimeLocalInput(w) : "");
  }, [editR]);

  async function add(e) {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount || "0") * 100);
    if (!cents) return show("Enter an amount", "error");
    await api.post("/resources", { amount_cents: cents, source_type: src, description: desc });
    setAmount("");
    setDesc("");
    load();
  }
  async function del(id) {
    await api.delete(`/resources/${id}`);
    load();
  }

  async function saveResourceEdit(e) {
    e.preventDefault();
    if (!editR) return;
    const cents = Math.round(parseFloat(rAmt || "0") * 100);
    if (!cents) return show("Enter an amount", "error");
    setRSaving(true);
    try {
      const body = {
        amount_cents: cents,
        description: rDesc,
        source_type: rSrc,
      };
      if (rWhen) body.at_utc = new Date(rWhen).toISOString();
      await api.patch(`/resources/${editR.id}`, body);
      show("Resource updated", "success");
      setEditR(null);
      load();
    } catch (err) {
      show(formatApiError(err), "error");
    } finally {
      setRSaving(false);
    }
  }

  return (
    <>
      <Section title="Add resource">
        <form onSubmit={add} className="p-4">
          <Field label="Amount"><input data-testid="resource-amount" className="input" type="number" step="0.01" value={amount} onChange={(e)=>setAmount(e.target.value)} /></Field>
          <Field label="Source">
            <select data-testid="resource-source" className="input" value={src} onChange={(e)=>setSrc(e.target.value)}>
              <option value="owner_contribution">Owner contribution</option>
              <option value="grant">Grant</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Description"><input data-testid="resource-desc" className="input" value={desc} onChange={(e)=>setDesc(e.target.value)} /></Field>
          <button data-testid="resource-add-btn" className="btn btn-primary w-full"><Plus size={16} /> Save</button>
        </form>
      </Section>
      <Section title={`Resources (${items.length})`}>
        {items.length === 0 ? <p className="p-4 text-sm text-ink-tertiary">Nothing here yet.</p> :
          items.map((r) => (
            <div key={r.id} className="row">
              <button
                type="button"
                className="min-w-0 flex-1 text-left border-0 bg-transparent cursor-pointer p-0"
                onClick={() => setEditR(r)}
              >
                <p className="text-sm truncate">{r.description || r.source_type}</p>
                <p className="text-xs text-ink-tertiary">
                  {r.source_type} · {fmtDateShort(r.at_utc || r.recorded_at_utc || r.created_at)}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-income">{fmtMoney(r.amount_cents, r.currency)}</span>
                <button type="button" onClick={() => del(r.id)} className="btn btn-ghost p-2 text-ink-tertiary">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
      </Section>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
      <FullSheet open={Boolean(editR)} title="Edit resource" onClose={() => setEditR(null)}>
        {editR && (
          <form onSubmit={saveResourceEdit}>
            <Field label="Amount">
              <input className="input" type="number" step="0.01" value={rAmt} onChange={(e) => setRAmt(e.target.value)} />
            </Field>
            <Field label="Source">
              <select className="input" value={rSrc} onChange={(e) => setRSrc(e.target.value)}>
                <option value="owner_contribution">Owner contribution</option>
                <option value="grant">Grant</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Description">
              <input className="input" value={rDesc} onChange={(e) => setRDesc(e.target.value)} />
            </Field>
            <Field label="Date / time (optional)">
              <input className="input" type="datetime-local" value={rWhen} onChange={(e) => setRWhen(e.target.value)} />
            </Field>
            <button type="submit" className="btn btn-primary w-full" disabled={rSaving}>
              {rSaving ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </FullSheet>
    </>
  );
}

// ------------ Tax estimator ------------
function TaxTab() {
  const [rate, setRate] = useState("25");
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      const start = new Date(new Date().getFullYear(), 0, 1).toISOString();
      const end = new Date().toISOString();
      const { data } = await api.get("/dashboard/summary", { params: { start, end } });
      setData(data);
    })();
  }, []);
  const taxable = data ? Math.max(0, data.income_cents - data.expense_cents) : 0;
  const owed = Math.round(taxable * (parseFloat(rate || "0") / 100));
  return (
    <>
      <Section title="Quick tax estimate (year-to-date)">
        <div className="p-4">
          <Field label="Tax rate (%)">
            <input data-testid="tax-rate" className="input" type="number" step="0.1" value={rate} onChange={(e)=>setRate(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Mini label="Income YTD" value={fmtMoney(data?.income_cents || 0)} />
            <Mini label="Expenses YTD" value={fmtMoney(data?.expense_cents || 0)} />
            <Mini label="Taxable (Net)" value={fmtMoney(taxable)} />
            <Mini label="Estimated tax" value={fmtMoney(owed)} accent="warn" />
          </div>
          <p className="text-xs text-ink-tertiary mt-3">Estimate only. Talk to a tax pro for filing.</p>
        </div>
      </Section>
    </>
  );
}

function Mini({ label, value, accent }) {
  const c = accent === "warn" ? "text-warn" : "text-ink-primary";
  return (
    <div className="card p-3">
      <p className="text-[10px] uppercase tracking-widest text-ink-tertiary">{label}</p>
      <p className={`font-heading text-lg font-bold ${c}`}>{value}</p>
    </div>
  );
}
