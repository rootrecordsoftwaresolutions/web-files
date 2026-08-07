import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../../lib/api";
import { ScreenHeader, PageContainer, Section, Field, Empty, Toast, useToast } from "../ui/Shell";
import { fmtMoney } from "../../lib/format";
import { FullSheet } from "../ui/FullSheet";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export default function Stock() {
  const { guest } = useAuth();
  const [tab, setTab] = useState("products");
  return (
    <>
      <ScreenHeader title="Stock & Supplies" subtitle="Sellable products and internal supplies" />
      <PageContainer>
        <div className="card p-1 flex mb-4">
          {[{id:"products",label:"Products"},{id:"supplies",label:"Supplies"}].map((t)=>(
            <button key={t.id} data-testid={`stock-tab-${t.id}`} onClick={()=>setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold ${tab===t.id ? "bg-bg-elevated text-ink-primary":"text-ink-tertiary"}`}>{t.label}</button>
          ))}
        </div>
        {guest ? <Empty title="Sign in to manage stock" /> :
          tab === "products" ? <Products /> : <Supplies />}
      </PageContainer>
    </>
  );
}

function Products() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState("");
  const [reorder, setReorder] = useState("");
  const [unit, setUnit] = useState("ea");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const { toast, show, clear } = useToast();
  const [editP, setEditP] = useState(null);
  const [pName, setPName] = useState("");
  const [pSku, setPSku] = useState("");
  const [pQty, setPQty] = useState("");
  const [pReorder, setPReorder] = useState("");
  const [pUnit, setPUnit] = useState("ea");
  const [pPrice, setPPrice] = useState("");
  const [pCost, setPCost] = useState("");
  const [pNotes, setPNotes] = useState("");
  const [pSaving, setPSaving] = useState(false);

  async function load() {
    const { data } = await api.get("/products");
    setItems(data);
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!editP) return;
    setPName(editP.name || "");
    setPSku(editP.sku || "");
    setPQty(String(editP.qty_on_hand ?? ""));
    setPReorder(String(editP.reorder_level ?? ""));
    setPUnit(editP.unit || "ea");
    setPPrice(((editP.unit_price_cents || 0) / 100).toFixed(2));
    setPCost(((editP.unit_cost_cents || 0) / 100).toFixed(2));
    setPNotes(editP.notes || "");
  }, [editP]);

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return show("Name required", "error");
    await api.post("/products", {
      name,
      sku,
      qty_on_hand: parseFloat(qty || "0"),
      reorder_level: parseFloat(reorder || "0"),
      unit,
      unit_price_cents: Math.round(parseFloat(price || "0") * 100),
      unit_cost_cents: Math.round(parseFloat(cost || "0") * 100),
      notes,
    });
    setName("");
    setSku("");
    setQty("");
    setReorder("");
    setPrice("");
    setCost("");
    setNotes("");
    show("Product saved", "success");
    load();
  }
  async function del(id) {
    await api.delete(`/products/${id}`);
    load();
  }

  async function saveProductEdit(e) {
    e.preventDefault();
    if (!editP || !pName.trim()) return show("Name required", "error");
    setPSaving(true);
    try {
      await api.patch(`/products/${editP.id}`, {
        name: pName.trim(),
        sku: pSku,
        qty_on_hand: parseFloat(pQty || "0"),
        reorder_level: parseFloat(pReorder || "0"),
        unit: pUnit,
        unit_price_cents: Math.round(parseFloat(pPrice || "0") * 100),
        unit_cost_cents: Math.round(parseFloat(pCost || "0") * 100),
        notes: pNotes,
      });
      show("Product updated", "success");
      setEditP(null);
      load();
    } catch (err) {
      show(formatApiError(err), "error");
    } finally {
      setPSaving(false);
    }
  }

  return (
    <>
      <Section title="Add product">
        <form onSubmit={add} className="p-4">
          <Field label="Name"><input data-testid="product-name" className="input" value={name} onChange={(e)=>setName(e.target.value)} /></Field>
          <Field label="SKU"><input data-testid="product-sku" className="input" value={sku} onChange={(e)=>setSku(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="label">Qty</span>
              <input data-testid="product-qty" className="input" type="number" step="0.01" value={qty} onChange={(e)=>setQty(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Reorder at</span>
              <input data-testid="product-reorder" className="input" type="number" step="0.01" value={reorder} onChange={(e)=>setReorder(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Unit</span>
              <input data-testid="product-unit" className="input" value={unit} onChange={(e)=>setUnit(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Cost</span>
              <input data-testid="product-cost" className="input" type="number" step="0.01" value={cost} onChange={(e)=>setCost(e.target.value)} />
            </label>
            <label className="block col-span-2">
              <span className="label">Price</span>
              <input data-testid="product-price" className="input" type="number" step="0.01" value={price} onChange={(e)=>setPrice(e.target.value)} />
            </label>
          </div>
          <Field label="Notes"><textarea className="input min-h-[60px] py-3" value={notes} onChange={(e)=>setNotes(e.target.value)} /></Field>
          <button data-testid="product-add-btn" className="btn btn-primary w-full"><Plus size={16} /> Save product</button>
        </form>
      </Section>
      <Section title={`Products (${items.length})`}>
        {items.length === 0 ? <p className="p-4 text-sm text-ink-tertiary">No products yet.</p> :
          items.map((p) => (
            <div key={p.id} data-testid={`product-row-${p.id}`} className="row">
              <button
                type="button"
                className="min-w-0 flex-1 text-left border-0 bg-transparent cursor-pointer p-0"
                onClick={() => setEditP(p)}
              >
                <p className="text-sm truncate">{p.name}</p>
                <p className="text-xs text-ink-tertiary">
                  SKU: {p.sku || "—"} · {p.qty_on_hand} {p.unit}
                  {p.qty_on_hand <= p.reorder_level && p.reorder_level > 0 && <span className="text-warn"> · LOW</span>}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{fmtMoney(p.unit_price_cents, p.currency)}</span>
                <button type="button" onClick={() => del(p.id)} className="btn btn-ghost p-2 text-ink-tertiary">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
      </Section>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
      <FullSheet open={Boolean(editP)} title="Edit product" onClose={() => setEditP(null)}>
        {editP && (
          <form onSubmit={saveProductEdit}>
            <Field label="Name">
              <input className="input" value={pName} onChange={(e) => setPName(e.target.value)} />
            </Field>
            <Field label="SKU">
              <input className="input" value={pSku} onChange={(e) => setPSku(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="label">Qty</span>
                <input className="input" type="number" step="0.01" value={pQty} onChange={(e) => setPQty(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Reorder at</span>
                <input className="input" type="number" step="0.01" value={pReorder} onChange={(e) => setPReorder(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Unit</span>
                <input className="input" value={pUnit} onChange={(e) => setPUnit(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Cost</span>
                <input className="input" type="number" step="0.01" value={pCost} onChange={(e) => setPCost(e.target.value)} />
              </label>
              <label className="block col-span-2">
                <span className="label">Price</span>
                <input className="input" type="number" step="0.01" value={pPrice} onChange={(e) => setPPrice(e.target.value)} />
              </label>
            </div>
            <Field label="Notes">
              <textarea className="input min-h-[60px] py-3" value={pNotes} onChange={(e) => setPNotes(e.target.value)} />
            </Field>
            <button type="submit" className="btn btn-primary w-full" disabled={pSaving}>
              {pSaving ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </FullSheet>
    </>
  );
}

function Supplies() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [cat, setCat] = useState("");
  const [qty, setQty] = useState("");
  const [reorder, setReorder] = useState("");
  const [unit, setUnit] = useState("ea");
  const [notes, setNotes] = useState("");
  const { toast, show, clear } = useToast();
  const [editS, setEditS] = useState(null);
  const [sName, setSName] = useState("");
  const [sVendor, setSVendor] = useState("");
  const [sCat, setSCat] = useState("");
  const [sQty, setSQty] = useState("");
  const [sReorder, setSReorder] = useState("");
  const [sUnit, setSUnit] = useState("ea");
  const [sNotes, setSNotes] = useState("");
  const [sSaving, setSSaving] = useState(false);

  async function load() {
    const { data } = await api.get("/supplies");
    setItems(data);
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!editS) return;
    setSName(editS.name || "");
    setSVendor(editS.vendor || "");
    setSCat(editS.category || "");
    setSQty(String(editS.qty_on_hand ?? ""));
    setSReorder(String(editS.reorder_level ?? ""));
    setSUnit(editS.unit || "ea");
    setSNotes(editS.notes || "");
  }, [editS]);

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return show("Name required", "error");
    await api.post("/supplies", {
      name,
      vendor,
      category: cat,
      qty_on_hand: parseFloat(qty || "0"),
      reorder_level: parseFloat(reorder || "0"),
      unit,
      notes,
    });
    setName("");
    setVendor("");
    setCat("");
    setQty("");
    setReorder("");
    setNotes("");
    show("Supply saved", "success");
    load();
  }
  async function del(id) {
    await api.delete(`/supplies/${id}`);
    load();
  }

  async function saveSupplyEdit(e) {
    e.preventDefault();
    if (!editS || !sName.trim()) return show("Name required", "error");
    setSSaving(true);
    try {
      await api.patch(`/supplies/${editS.id}`, {
        name: sName.trim(),
        vendor: sVendor,
        category: sCat,
        qty_on_hand: parseFloat(sQty || "0"),
        reorder_level: parseFloat(sReorder || "0"),
        unit: sUnit,
        notes: sNotes,
      });
      show("Supply updated", "success");
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
      <Section title="Add supply">
        <form onSubmit={add} className="p-4">
          <Field label="Name"><input data-testid="supply-name" className="input" value={name} onChange={(e)=>setName(e.target.value)} /></Field>
          <Field label="Vendor"><input data-testid="supply-vendor" className="input" value={vendor} onChange={(e)=>setVendor(e.target.value)} /></Field>
          <Field label="Category"><input data-testid="supply-category" className="input" value={cat} onChange={(e)=>setCat(e.target.value)} /></Field>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <label className="block">
              <span className="label">Qty</span>
              <input data-testid="supply-qty" className="input" type="number" step="0.01" value={qty} onChange={(e)=>setQty(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Reorder</span>
              <input data-testid="supply-reorder" className="input" type="number" step="0.01" value={reorder} onChange={(e)=>setReorder(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Unit</span>
              <input data-testid="supply-unit" className="input" value={unit} onChange={(e)=>setUnit(e.target.value)} />
            </label>
          </div>
          <Field label="Notes"><textarea className="input min-h-[60px] py-3" value={notes} onChange={(e)=>setNotes(e.target.value)} /></Field>
          <button data-testid="supply-add-btn" className="btn btn-primary w-full"><Plus size={16} /> Save supply</button>
        </form>
      </Section>
      <Section title={`Supplies (${items.length})`}>
        {items.length === 0 ? <p className="p-4 text-sm text-ink-tertiary">No supplies yet.</p> :
          items.map((s) => (
            <div key={s.id} data-testid={`supply-row-${s.id}`} className="row">
              <button
                type="button"
                className="min-w-0 flex-1 text-left border-0 bg-transparent cursor-pointer p-0"
                onClick={() => setEditS(s)}
              >
                <p className="text-sm truncate">{s.name}</p>
                <p className="text-xs text-ink-tertiary">
                  {s.vendor || "—"} · {s.qty_on_hand} {s.unit}
                  {s.qty_on_hand <= s.reorder_level && s.reorder_level > 0 && <span className="text-warn"> · LOW</span>}
                </p>
              </button>
              <button type="button" onClick={() => del(s.id)} className="btn btn-ghost p-2 text-ink-tertiary">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
      </Section>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
      <FullSheet open={Boolean(editS)} title="Edit supply" onClose={() => setEditS(null)}>
        {editS && (
          <form onSubmit={saveSupplyEdit}>
            <Field label="Name">
              <input className="input" value={sName} onChange={(e) => setSName(e.target.value)} />
            </Field>
            <Field label="Vendor">
              <input className="input" value={sVendor} onChange={(e) => setSVendor(e.target.value)} />
            </Field>
            <Field label="Category">
              <input className="input" value={sCat} onChange={(e) => setSCat(e.target.value)} />
            </Field>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <label className="block">
                <span className="label">Qty</span>
                <input className="input" type="number" step="0.01" value={sQty} onChange={(e) => setSQty(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Reorder</span>
                <input className="input" type="number" step="0.01" value={sReorder} onChange={(e) => setSReorder(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Unit</span>
                <input className="input" value={sUnit} onChange={(e) => setSUnit(e.target.value)} />
              </label>
            </div>
            <Field label="Notes">
              <textarea className="input min-h-[60px] py-3" value={sNotes} onChange={(e) => setSNotes(e.target.value)} />
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
