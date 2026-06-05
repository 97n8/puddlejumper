#!/usr/bin/env python3
"""
MichiganLTC_Network_Financial_Model_FINAL.xlsx — DEFINITIVE reconciliation, keyed to the
uploaded Canonical_Financial_Model v2.0 (executed WasteWerx Model 3 License Pro Forma) and
cross-checked against the Financial_Reconciliation_Workbook and the EM&S Investor Brief.

THE CENTRAL FINDING: the signed $30,200,531 EBITDA is real as a document, but it sits on a
Pro Forma opex of $5,381,149 that assumes only 4 FTE + 1 manager ($425,000) — while WasteWerx's
own STAFFING pro forma says the plant needs 62 FTE ($5,522,400). And $20,428,560 of the
$35,581,680 revenue is RIN + Section 45Z, contingent on EPA RFS registration (Flag 3). So the
model shows BOTH the Pro Forma-as-signed and the operator-reality stress case, and splits base
fuel from contingent credits. All figures are signed-document values or formulas over them.
Carbon black = $0 in the executed Pro Forma (Flag 1). Live formulas; zero errors.
Not financial/legal/securities/tax advice.
"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import os

BOLD=Font(bold=True); HDR=Font(bold=True,color="FFFFFF")
HFILL=PatternFill("solid",fgColor="1F4E5F"); IN=PatternFill("solid",fgColor="FFF2CC")
GREEN=PatternFill("solid",fgColor="E2EFDA"); ORANGE=PatternFill("solid",fgColor="FCE4D6")
RED=PatternFill("solid",fgColor="F4C7C3"); NOTE=Font(italic=True,size=9,color="555555")
THIN=Side(style="thin",color="BBBBBB"); B=Border(left=THIN,right=THIN,top=THIN,bottom=THIN)
CTR=Alignment(horizontal="center",vertical="center"); WRAP=Alignment(wrap_text=True,vertical="top")
M='#,##0'

def H(ws,row,cols,start=1):
    for i,c in enumerate(cols):
        x=ws.cell(row=row,column=start+i,value=c); x.font=HDR; x.fill=HFILL; x.border=B; x.alignment=CTR
def T(ws,t,s=None):
    ws["A1"]=t; ws["A1"].font=Font(bold=True,size=14,color="1F4E5F")
    if s: ws["A2"]=s; ws["A2"].font=NOTE

wb=openpyxl.Workbook()

# README
ws=wb.active; ws.title="README"
T(ws,"Michigan LTC — Financial Model (keyed to Canonical v2.0 / executed Pro Forma)",
  "Every figure is a signed-document value or a formula over one. Yellow = input. Date 2026-06-03. Not financial/legal advice.")
for r,ln in enumerate([
 "","THE CENTRAL FINDING",
 "  The signed $30,200,531 EBITDA is real as a DOCUMENT, but it rests on two things diligence will test:",
 "   1. OPEX: the Pro Forma opex of $5,381,149 assumes only 4 FTE + 1 manager ($425,000). WasteWerx's OWN staffing",
 "      pro forma says the plant needs 62 FTE ($5,522,400). On operator-reality staffing the EBITDA falls to ~$22M.",
 "   2. CREDITS: $20,428,560 of the $35,581,680 revenue is RIN + Section 45Z — contingent on EPA RFS registration",
 "      (Flag 3). Base fuel (RD+SAF) is only $15,153,120. Carbon black is $0 in the executed Pro Forma (Flag 1).",
 "","THREE INCOMPATIBLE REVENUE MODELS (reconciled here)",
 "  * Investor Brief / EM&S deck: raw oil $6.75M + carbon black $10.125M = $16.875M (credits EXCLUDED as upside).",
 "  * Canonical v2.0 (executed Pro Forma): distilled fuel RD+SAF $15.15M + credits $20.43M = $35.58M (CB EXCLUDED).",
 "  * This model uses the Canonical (signed) split and shows the deck's alternative for reference.",
 "","HOW TO READ",
 "  Revenue  - exact RD/SAF/RIN/45Z build-up (Canonical Revenue tab).",
 "  Opex     - Pro Forma (as signed, 5 FTE) vs Operator-reality (62-FTE staffing + real feedstock). Two cases.",
 "  P&L      - EBITDA matrix: revenue case x opex case. The honest range, not a single number.",
 "  Corridor - 3-site rollup. Capital - the two raises. Flags - the open commercial items + support letters.",
 "","Confirmed support letters on file: Geocycle (Paolo Carollo) 1/26/26; U-Arizona (Dr. Joel Cuello) 2/10/26;",
 "  Acadia/Brien Walton validation 5/8/26; WasteWerx mutual NDA executed 5/18/26.",
],start=4):
    c=ws.cell(row=r,column=1,value=ln)
    if ln.strip() in ("THE CENTRAL FINDING","THREE INCOMPATIBLE REVENUE MODELS (reconciled here)","HOW TO READ"):
        c.font=Font(bold=True,size=11,color="1F4E5F")
ws.column_dimensions["A"].width=112

# INPUTS
wi=wb.create_sheet("Inputs"); T(wi,"Inputs — signed-document values (Canonical v2.0)","Yellow = editable. Revenue & Pro Forma opex are executed-Pro-Forma values; stress levers are the diligence swings.")
wi.append([]); wi.append(["Key","Assumption","Value","Unit","Source"]); H(wi,wi.max_row,["Key","Assumption","Value","Unit","Source"])
inp=[
 ("rd_sales","RD fuel sales (2,399,040 gal x $2.00)",4798080,"$/yr","Canonical Revenue B10"),
 ("saf_sales","SAF fuel sales (2,301,120 gal x $4.50)",10355040,"$/yr","Canonical Revenue B11"),
 ("d4_rin","D4 RIN — RD ($2.00/gal)",4798080,"$/yr","Canonical Revenue B12 — Flag 3 (RFS)"),
 ("d7_rin","D7 RIN — SAF ($4.00/gal)",9204480,"$/yr","Canonical Revenue B13 — Flag 3 (RFS)"),
 ("z45_rd","Section 45Z — RD ($1.00/gal)",2399040,"$/yr","Canonical Revenue B14 — Flag 3"),
 ("z45_saf","Section 45Z — SAF ($1.75/gal)",4026960,"$/yr","Canonical Revenue B15 — Flag 3"),
 ("cb_upside","Carbon black (UPSIDE, excluded from base)",0,"$/yr","Canonical Flag 1; deck implied ~$10.125M — uncontracted"),
 ("ww_fees","WasteWerx fees (monitoring $420k + royalty $2,820,096)",3240096,"$/yr","Canonical Per-Site P&L"),
 ("feedstock_pf","Feedstock — Pro Forma ($0.20/gal)",940032,"$/yr","Canonical Per-Site P&L"),
 ("utilities","Utilities ($0.05/gal)",235008,"$/yr","Canonical Per-Site P&L"),
 ("distribution","Fuel distribution & shipping ($0.08/gal)",376013,"$/yr","Canonical Per-Site P&L"),
 ("labor_pf","Operating labor — Pro Forma (4 FTE + manager)",425000,"$/yr","Canonical Per-Site P&L"),
 ("insurance","Insurance (GL + property)",65000,"$/yr","Canonical Per-Site P&L"),
 ("permits","Permit renewals & compliance",25000,"$/yr","Canonical Per-Site P&L"),
 ("ga","G&A overhead",75000,"$/yr","Canonical Per-Site P&L"),
 ("labor_real","Operating labor — STAFFING pro forma (62 FTE)",5522400,"$/yr","WasteWerx Staffing Pro Forma (worst-case; cross-train reduces)"),
 ("mi_adj","Michigan labor adjustment",1.05,"x","FL->MI [Robert]"),
 ("xtrain","Cross-training factor (<1.0 reduces)",1.00,"x","Vincent Tizio 5/27: staffing is worst-case"),
 ("feedstock_real","Feedstock — operator reality",3720000,"$/yr","Deck $200/ton landed; vs ERR $25/ton tipping = ~$1M [CONFIRM]"),
 ("y1_cashout","Year 1 cash out (WasteWerx $6,670,328 + capex $952,500)",7622828,"$","Canonical — CONFIRMED"),
 ("raise_site","Project raise per site",15000000,"$","sponsor"),
 ("company_raise","Company-level raise (separate)",2500000,"$","sponsor"),
 ("comm_share","Community profit share (of EBITDA)",0.10,"of EBITDA","Canonical — contractual, locally directed"),
 ("sites","Sites in corridor",3,"#","Lincoln/Flint/Coleman (Coldwater = Phase 2)"),
]
k={}; r0=wi.max_row+1
for i,(key,lab,val,unit,src) in enumerate(inp):
    rr=r0+i
    wi.cell(row=rr,column=1,value=key).font=Font(bold=True,color="888888",size=9)
    wi.cell(row=rr,column=2,value=lab)
    c=wi.cell(row=rr,column=3,value=val); c.fill=IN; c.border=B
    c.number_format='0.00' if isinstance(val,float) else (M if isinstance(val,(int,float)) and val>=1000 else '0')
    wi.cell(row=rr,column=4,value=unit); wi.cell(row=rr,column=5,value=src).font=NOTE
    k[key]=f"Inputs!$C${rr}"
for col,w in zip("ABCDE",[14,48,14,12,52]): wi.column_dimensions[col].width=w
def K(x): return k[x]

# REVENUE
wr=wb.create_sheet("Revenue"); T(wr,"Revenue build-up (Canonical Revenue tab — executed Pro Forma)","Green = base fuel (sells today). Orange = contingent credits (RFS/45Z). Carbon black = $0 base (Flag 1).")
H(wr,4,["Stream","$/yr","Category","Note"])
rev=[
 ("Renewable diesel sales", f"={K('rd_sales')}","BASE FUEL","2,399,040 gal x $2.00 — sells on contract/market"),
 ("SAF / kerosene sales", f"={K('saf_sales')}","BASE FUEL","2,301,120 gal x $4.50 — confirm SAF offtake + classification"),
 ("D4 RIN — RD", f"={K('d4_rin')}","CONTINGENT","RFS registration required (Flag 3)"),
 ("D7 RIN — SAF", f"={K('d7_rin')}","CONTINGENT","RFS registration required (Flag 3)"),
 ("Section 45Z — RD", f"={K('z45_rd')}","CONTINGENT","45Z qualification + tax counsel (Flag 3)"),
 ("Section 45Z — SAF", f"={K('z45_saf')}","CONTINGENT","45Z qualification + tax counsel (Flag 3)"),
 ("Carbon black", f"={K('cb_upside')}","UPSIDE","$0 in executed Pro Forma (Flag 1); deck ~$10.125M — uncontracted"),
]
r=5
for lab,f,cat,nt in rev:
    wr.cell(row=r,column=1,value=lab).alignment=WRAP
    c=wr.cell(row=r,column=2,value=f); c.number_format=M
    c.fill=GREEN if cat=="BASE FUEL" else (ORANGE if cat=="CONTINGENT" else IN)
    wr.cell(row=r,column=3,value=cat).alignment=CTR
    wr.cell(row=r,column=4,value=nt).alignment=WRAP
    for cc in range(1,5): wr.cell(row=r,column=cc).border=B
    r+=1
wr.cell(row=13,column=1,value="Base fuel (RD+SAF)").font=BOLD
wr.cell(row=13,column=2,value=f"=B5+B6").number_format=M; wr.cell(row=13,column=2).fill=GREEN; wr.cell(row=13,column=2).font=BOLD
wr.cell(row=14,column=1,value="Contingent credits (RIN+45Z)").font=BOLD
wr.cell(row=14,column=2,value=f"=B7+B8+B9+B10").number_format=M; wr.cell(row=14,column=2).fill=ORANGE; wr.cell(row=14,column=2).font=BOLD
wr.cell(row=15,column=1,value="TOTAL REVENUE (Pro Forma)").font=BOLD
wr.cell(row=15,column=2,value=f"=B13+B14+B11").number_format=M; wr.cell(row=15,column=2).fill=GREEN; wr.cell(row=15,column=2).font=Font(bold=True,size=12)
for col,w in zip("ABCD",[30,16,13,52]): wr.column_dimensions[col].width=w
REV_FUEL="Revenue!$B$13"; REV_CREDITS="Revenue!$B$14"; REV_TOTAL="Revenue!$B$15"

# OPEX — two cases
wo=wb.create_sheet("Opex"); T(wo,"Operating cost — two cases (the diligence swing)","Pro Forma (as signed, 5 FTE / $0.20-gal feedstock) vs Operator-reality (62-FTE staffing + real feedstock).")
H(wo,4,["Line","Pro Forma (signed)","Operator-reality","Note"])
lines=[
 ("WasteWerx fees (monitoring+royalty)", f"={K('ww_fees')}", f"={K('ww_fees')}","same"),
 ("Feedstock", f"={K('feedstock_pf')}", f"={K('feedstock_real')}","PF $0.20/gal vs deck $200/ton; ERR tipping $25/ton ~ $1M — SWING"),
 ("Utilities", f"={K('utilities')}", f"={K('utilities')}","same"),
 ("Fuel distribution & shipping", f"={K('distribution')}", f"={K('distribution')}","same"),
 ("Operating labor", f"={K('labor_pf')}", f"={K('labor_real')}*{K('mi_adj')}*{K('xtrain')}","PF 5 FTE $425k vs staffing 62 FTE $5.52M — BIGGEST SWING"),
 ("Insurance", f"={K('insurance')}", f"={K('insurance')}","same"),
 ("Permit renewals & compliance", f"={K('permits')}", f"={K('permits')}","same"),
 ("G&A overhead", f"={K('ga')}", f"={K('ga')}","same"),
]
r=5
for lab,pf,orr,nt in lines:
    wo.cell(row=r,column=1,value=lab).alignment=WRAP
    a=wo.cell(row=r,column=2,value=pf); a.number_format=M
    b2=wo.cell(row=r,column=3,value=orr); b2.number_format=M
    if "SWING" in nt: a.fill=ORANGE; b2.fill=ORANGE
    wo.cell(row=r,column=4,value=nt).alignment=WRAP
    for cc in range(1,5): wo.cell(row=r,column=cc).border=B
    r+=1
wo.cell(row=13,column=1,value="TOTAL OPEX").font=BOLD
pf_t=wo.cell(row=13,column=2,value="=SUM(B5:B12)"); pf_t.number_format=M; pf_t.fill=GREEN; pf_t.font=BOLD
or_t=wo.cell(row=13,column=3,value="=SUM(C5:C12)"); or_t.number_format=M; or_t.fill=ORANGE; or_t.font=BOLD
wo.cell(row=14,column=1,value="Delta (operator-reality - pro forma)").font=BOLD
wo.cell(row=14,column=3,value="=C13-B13").number_format=M; wo.cell(row=14,column=3).fill=RED; wo.cell(row=14,column=3).font=BOLD
for col,w in zip("ABCD",[34,18,18,52]): wo.column_dimensions[col].width=w
OPEX_PF="Opex!$B$13"; OPEX_OR="Opex!$C$13"

# P&L matrix
wp=wb.create_sheet("P&L"); T(wp,"EBITDA matrix — revenue case x opex case (the honest range)","Pro Forma-as-signed is one cell. The rest is the diligence reality. Community share = 10% of EBITDA.")
H(wp,4,["Revenue case","Revenue","Opex (Pro Forma)","EBITDA (PF)","Opex (Operator)","EBITDA (Operator)"])
cases=[
 ("Base fuel only (no credits, no CB)", REV_FUEL),
 ("Fuel + credits (Pro Forma total)", REV_TOTAL),
]
r=5
for lab,rev_ref in cases:
    wp.cell(row=r,column=1,value=lab).alignment=WRAP
    wp.cell(row=r,column=2,value=f"={rev_ref}").number_format=M
    wp.cell(row=r,column=3,value=f"={OPEX_PF}").number_format=M
    e1=wp.cell(row=r,column=4,value=f"=B{r}-C{r}"); e1.number_format=M; e1.font=BOLD; e1.fill=GREEN
    wp.cell(row=r,column=5,value=f"={OPEX_OR}").number_format=M
    e2=wp.cell(row=r,column=6,value=f"=B{r}-E{r}"); e2.number_format=M; e2.font=BOLD; e2.fill=ORANGE
    for cc in range(1,7): wp.cell(row=r,column=cc).border=B
    r+=1
wp.cell(row=8,column=1,value="SIGNED HEADLINE = Fuel+credits @ Pro Forma opex").font=BOLD
wp.cell(row=8,column=2,value=f"={REV_TOTAL}").number_format=M
wp.cell(row=8,column=4,value="=D6").number_format=M; wp.cell(row=8,column=4).fill=GREEN; wp.cell(row=8,column=4).font=Font(bold=True,size=12)
wp.cell(row=9,column=1,value="DILIGENCE REALITY = Fuel+credits @ operator opex").font=BOLD
wp.cell(row=9,column=6,value="=F6").number_format=M; wp.cell(row=9,column=6).fill=ORANGE; wp.cell(row=9,column=6).font=Font(bold=True,size=12)
wp.cell(row=10,column=1,value="WITHOUT CREDITS @ operator opex (the floor)").font=BOLD
wp.cell(row=10,column=6,value="=F5").number_format=M; wp.cell(row=10,column=6).fill=RED; wp.cell(row=10,column=6).font=Font(bold=True,size=12)
wp.cell(row=12,column=1,value="Community profit share (10% of signed EBITDA)").font=BOLD
wp.cell(row=12,column=4,value=f"=D6*{K('comm_share')}").number_format=M
for col,w in zip("ABCDEF",[42,15,15,15,15,16]): wp.column_dimensions[col].width=w

# CORRIDOR
wcx=wb.create_sheet("Corridor"); T(wcx,"3-site corridor rollup (Lincoln/Flint/Coleman)","Both the signed headline and the operator-reality EBITDA, x3.")
H(wcx,4,["Metric","Per site","x Sites","Corridor total"])
cor=[
 ("Total revenue (Pro Forma)", f"={REV_TOTAL}"),
 ("EBITDA — signed (PF opex)", "='P&L'!D6"),
 ("EBITDA — operator-reality", "='P&L'!F6"),
 ("EBITDA — base fuel only @ operator opex", "='P&L'!F5"),
 ("Year 1 cash out", f"={K('y1_cashout')}"),
]
r=5
for lab,per in cor:
    wcx.cell(row=r,column=1,value=lab).alignment=WRAP
    wcx.cell(row=r,column=2,value=per).number_format=M
    wcx.cell(row=r,column=3,value=f"={K('sites')}").alignment=CTR
    t=wcx.cell(row=r,column=4,value=f"=B{r}*C{r}"); t.number_format=M; t.font=BOLD
    t.fill=GREEN if "signed" in lab else (ORANGE if "operator" in lab else IN)
    for cc in range(1,5): wcx.cell(row=r,column=cc).border=B
    r+=1
for col,w in zip("ABCD",[40,16,9,18]): wcx.column_dimensions[col].width=w

# CAPITAL
wcap=wb.create_sheet("Capital"); T(wcap,"Capital & the two raises","Site capital != company capital. Year 1 cash out is confirmed.")
H(wcap,4,["Item","Amount","Note"])
cap=[
 ("Year 1 cash out per site", f"={K('y1_cashout')}","CONFIRMED (WasteWerx $6,670,328 + capex $952,500)"),
 ("Project raise per site", f"={K('raise_site')}","sponsor headline"),
 ("Project raises — 3 sites", f"={K('raise_site')}*{K('sites')}","excludes company raise"),
 ("Company-level raise (separate)", f"={K('company_raise')}","working capital, payroll, PL gov, team [CONFIRM split]"),
 ("Combined discussion envelope", f"={K('raise_site')}*{K('sites')}+{K('company_raise')}","present asks separately"),
]
r=5
for lab,f,nt in cap:
    wcap.cell(row=r,column=1,value=lab); c=wcap.cell(row=r,column=2,value=f); c.number_format=M; c.font=BOLD
    wcap.cell(row=r,column=3,value=nt).alignment=WRAP
    for cc in range(1,4): wcap.cell(row=r,column=cc).border=B
    r+=1
for col,w in zip("ABC",[32,18,56]): wcap.column_dimensions[col].width=w

# FLAGS
wf=wb.create_sheet("Flags"); T(wf,"Open items (commercial, not modeling) + structure flags + support letters","From Canonical Flags + Reconciliation discrepancy log + Investor Brief.")
items=[
 "REVENUE / OPEX (the diligence questions)",
 "  * Flag 1 — Carbon black: $0 in executed Pro Forma; deck implied ~$10.125M. Feedstock Yield Model rates tires 32% carbon",
 "    co-product (graphene-precursor grade) — REAL but UNCONTRACTED. Upside only until grade + price contracted.",
 "  * Flag 3 — RFS / 45Z: $20,428,560 of the $35.58M is RIN + 45Z. Requires EPA RFS pathway petition + 3rd-party engineering",
 "    review + favorable 45Z CI. Without registration, this revenue does not exist. Phase 1 workstream.",
 "  * STAFFING TENSION: Pro Forma opex uses 4 FTE + manager ($425k); WasteWerx STAFFING pro forma says 62 FTE ($5.52M).",
 "    This single swing moves EBITDA from $30.2M (signed) to ~$22M (operator-reality). Resolve actual headcount with WasteWerx.",
 "  * FEEDSTOCK SWING: Pro Forma $0.20/gal ($940k) vs deck $200/ton ($3.72M) vs ERR $25/ton tipping (~$1M). Confirm with Robert.",
 "",
 "STRUCTURE / LEGAL (Canonical AUTHORITY/TRANSFER flags)",
 "  * Flag 2 — License NOT depreciable: title stays with WasteWerx; no transfer on EM&S dissolution. Brief Walton before any",
 "    DCF/investor return model. Address transfer in SPV structure. IoT-metered royalty -> audit rights in operating agreement.",
 "  * MAR Year 1 = 70% of nameplate (not 80%); Year 2+ = 80%. Early termination after Yr3: current MAR + 50% next-year MAR.",
 "  * Securities: investor structures (deck $3.5M/yr 4yr vs agreement $5M/yr + balloon = $40M) are unreconciled AND likely",
 "    securities offerings with no Reg D / PPM / sub docs. Securities counsel before any investor circulation. PL = governance,",
 "    NOT placement agent; fee fixed/non-contingent.",
 "  * Revenue distribution: agreement allocates only 54.5% (Operator 21 + Owner 12 + Supplier 1.5 + REIT 20); 45.5% undefined.",
 "",
 "CONFIRMED SUPPORT / DOCUMENTS ON FILE",
 "  * Geocycle (Paolo Carollo) — letter of support 1/26/26. University of Arizona (Dr. Joel Cuello) — support 2/10/26.",
 "  * Acadia Capital (Brien Walton) — advisory validation 5/8/26. WasteWerx mutual NDA executed 5/18/26.",
 "  * ERR — 10-yr feedstock supply, 40,000 t/yr at $25/ton tipping (Dort Hwy). Lake State Railway — rail logistics.",
 "",
 "Not financial/legal/securities/tax advice. Keyed to executed Pro Forma; resolve flags before investor circulation.",
]
r=4
for ln in items:
    c=wf.cell(row=r,column=1,value=ln)
    c.font=Font(bold=True,size=11,color="1F4E5F") if ln.strip() in ("REVENUE / OPEX (the diligence questions)","STRUCTURE / LEGAL (Canonical AUTHORITY/TRANSFER flags)","CONFIRMED SUPPORT / DOCUMENTS ON FILE") else NOTE
    r+=1
wf.column_dimensions["A"].width=120

out=os.path.join(os.path.dirname(os.path.abspath(__file__)),"MichiganLTC_Network_Financial_Model_FINAL.xlsx")
wb.save(out); print("wrote",out)
