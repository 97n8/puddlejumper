#!/usr/bin/env python3
"""
PublicLogic — Capabilities Workbook (institutional positioning + working BD tool).
From the Business Development & Market Positioning Workbook v2.0. Styled to the firm
palette. A real working set: service catalog, signature offerings (editable scope/fee),
the Nathan+Allie model, transfer assets, a target-market pipeline (editable status/owner/
next-step), lessons learned, and positioning/messaging.
"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import os

SLATE="1A1D20"; GREEN="0F4C3A"; GOLD="A9772F"; CREAM="F5F4F0"; CREAMW="ECEAE3"; GREENL="E3EAE5"
HDR=Font(bold=True,color="FFFFFF",size=11); HFILL=PatternFill("solid",fgColor=SLATE)
GHFILL=PatternFill("solid",fgColor=GREEN); TITLE=Font(bold=True,size=15,color=SLATE)
SUB=Font(italic=True,size=9,color="6B6660"); GLD=Font(bold=True,size=10,color=GOLD)
SEC=Font(bold=True,size=12,color=GREEN); BOLD=Font(bold=True)
CFILL=PatternFill("solid",fgColor=CREAMW); GFILL=PatternFill("solid",fgColor=GREENL); IFILL=PatternFill("solid",fgColor="FFF2CC")
THIN=Side(style="thin",color="CCCCCC"); B=Border(left=THIN,right=THIN,top=THIN,bottom=THIN)
WRAP=Alignment(wrap_text=True,vertical="top"); CTR=Alignment(horizontal="center",vertical="center")

wb=openpyxl.Workbook()
def hrow(ws,r,cols,fill=HFILL,start=1):
    for i,c in enumerate(cols):
        x=ws.cell(row=r,column=start+i,value=c); x.font=HDR; x.fill=fill; x.border=B; x.alignment=Alignment(wrap_text=True,vertical="center")
def tab(name,title,sub=None):
    ws=wb.create_sheet(name); ws["A1"]=title; ws["A1"].font=TITLE
    if sub: ws["A2"]=sub; ws["A2"].font=SUB
    return ws
def table(ws,top,headers,rows,widths,fill=HFILL,editable_cols=()):
    hrow(ws,top,headers,fill)
    for ri,row in enumerate(rows):
        for ci,val in enumerate(row):
            c=ws.cell(row=top+1+ri,column=ci+1,value=val); c.border=B; c.alignment=WRAP
            if ci in editable_cols: c.fill=IFILL
    for i,w in enumerate(widths): ws.column_dimensions[openpyxl.utils.get_column_letter(i+1)].width=w
    ws.freeze_panes=f"A{top+1}"

# ---- COVER / POSITIONING ----
ws=wb.active; ws.title="Positioning"
ws["A1"]="PUBLICLOGIC — Capabilities Workbook"; ws["A1"].font=Font(bold=True,size=16,color=SLATE)
ws["A2"]="Institutional Stewardship through Project Delivery  ·  v2.0  ·  June 2026"; ws["A2"].font=Font(size=11,bold=True,color=GOLD)
blocks=[
 ("WHAT WE ARE","PublicLogic applies Institutional Stewardship to help communities and mission-driven organizations move important projects from planning to implementation."),
 ("THE DISTINCTION","Implementation is the service. Institutional Stewardship is the method. The market buys project delivery; PublicLogic delivers Institutional Stewardship. Both are true; neither is sacrificed for the other."),
 ("WHAT WE ARE NOT","Not a grant-writing firm. Not an AI consulting firm. Not a traditional planning firm. We don't produce reports or plans that sit on shelves."),
 ("POSITIONING STATEMENT","PublicLogic helps communities and mission-driven organizations move important projects from planning to implementation. We do this through Institutional Stewardship — preserving, governing, transferring, and operationalizing the knowledge required for long-term success."),
 ("INSTITUTIONAL STEWARDSHIP (definition)","The deliberate practice of preserving, governing, transferring, and operationalizing organizational knowledge so critical functions remain durable across turnover, changing priorities, and organizational change. An operating discipline, applied to every engagement regardless of project type."),
 ("SUCCESS STANDARD","A successful engagement reduces future dependency. The organization becomes more capable; the process more durable; the knowledge more accessible."),
]
r=4
for k,v in blocks:
    ws.cell(row=r,column=1,value=k).font=HDR; ws.cell(row=r,column=1).fill=GHFILL; ws.cell(row=r,column=1).border=B; ws.cell(row=r,column=1).alignment=Alignment(wrap_text=True,vertical="center")
    c=ws.cell(row=r,column=2,value=v); c.alignment=WRAP; c.border=B; c.fill=CFILL
    r+=1
ws.column_dimensions["A"].width=24; ws.column_dimensions["B"].width=104
for rr in range(4,r): ws.row_dimensions[rr].height=46

# ---- SERVICE CATALOG ----
ws=tab("Service Catalog","Core Service Lines","Three services, one discipline. Stewardship objective shown per line.")
table(ws,4,
 ["Service","Purpose","Common Engagements","Deliverables","Stewardship Objective"],
 [
 ["Project Development","Transform ideas, priorities, and challenges into actionable projects.","Strategic initiatives · capital projects · community development · housing · infrastructure · program development","Project Charter · Scope Definition · Stakeholder Map · Readiness Assessment · Action Roadmap","Create clarity before resources are committed."],
 ["Funding Strategy","Identify, organize, and pursue sustainable funding opportunities.","Grant development · capital planning · funding roadmaps · partnership development · revenue strategy","Funding Scan · Funding Roadmap · Application Support · Capital Strategy · Partner Coordination","Align funding with long-term organizational capacity."],
 ["Implementation Support","Move projects from planning into execution.","Strategic-plan implementation · capital project coordination · program launch · community engagement · readiness","Implementation Framework · Accountability Structure · Progress Tracking · Facilitation · Stakeholder Coordination","Ensure important work survives beyond its initial champions."],
 ],
 [22,34,40,40,40])

# ---- SIGNATURE OFFERINGS (editable scope/fee) ----
ws=tab("Signature Offerings","Signature Offerings","Three ways to start. Yellow = fill in scope, duration, and fee per engagement.")
table(ws,4,
 ["Offering","Purpose","Output","Scope (fill)","Duration (fill)","Fee (fill)"],
 [
 ["Project Development Sprint","Move an idea into an actionable project.","Project Development Roadmap","","",""],
 ["Funding Strategy Sprint","Identify realistic funding pathways and readiness requirements.","Funding Roadmap","","",""],
 ["Implementation Support Partnership","Provide coordination and stewardship capacity through implementation.","Implementation Framework + Accountability Structure","","",""],
 ],
 [30,40,38,26,16,16],editable_cols=(3,4,5))

# ---- THE MODEL ----
ws=tab("The Model","The Nathan + Allie Model","Institutional systems and human systems are interdependent — projects fail when either is ignored.")
table(ws,4,
 ["","Nathan — Institutional Systems","Allie — Human Systems"],
 [
 ["Expertise","Municipal administration · finance · capital planning · procurement · grants · economic development · governance · project delivery","Organizational readiness · stakeholder engagement · leadership development · program design · evaluation · behavioral systems · change management"],
 ["Experience","Town Administrator · City Councilor · Town Clerk · Consultant","Clinical leadership · organizational consulting · program development · workforce systems"],
 ["The pairing","Most firms understand systems OR people.","PublicLogic is designed to understand both."],
 ],
 [16,52,52])

# ---- TRANSFER ASSETS ----
ws=tab("Transfer Assets","Transfer Assets","A core principle of stewardship: every engagement creates reusable organizational assets.")
table(ws,4,
 ["Asset","What it is","Leaves the client with"],
 [
 ["LogicCommons","Shared frameworks, templates, and operational resources.","Reusable standards"],
 ["Workbooks","Structured implementation and planning guides.","Repeatable process"],
 ["CaseSpaces","Project-specific operating environments.","A governed record"],
 ["PuddleJumper","Process architecture and workflow infrastructure.","Operating continuity"],
 ["VAULT","Knowledge preservation and continuity framework.","Durability across turnover"],
 ],
 [18,56,30])

# ---- TARGET MARKETS / PIPELINE (editable) ----
ws=tab("Target Pipeline","Target Markets & Pipeline (Tier 1)","Prioritize organizations that already have projects and budgets. Yellow = working pipeline fields.")
table(ws,4,
 ["Segment","Named Target","Why / Need","Status","Owner","Next Step"],
 [
 ["Regional Planning Agencies","CMRPC","Municipal implementation support; active project pipelines","","",""],
 ["Regional Planning Agencies","MRPC","Delivery capacity; community engagement","","",""],
 ["Regional Planning Agencies","MVPC","Project delivery capacity","","",""],
 ["Regional Planning Agencies","Strafford RPC","Municipal implementation support","","",""],
 ["Engineering Firms","Fuss & O'Neill","Public-process support; funding narratives; municipal coordination","","",""],
 ["Engineering Firms","Weston & Sampson","Municipal implementation capacity","","",""],
 ["Engineering Firms","Tighe & Bond","Public process + funding narratives","","",""],
 ["Engineering Firms","BETA","Municipal coordination capacity","","",""],
 ["Municipal Consulting","Community Paradigm (and similar)","Capacity + specialized expertise; subcontracting path","","",""],
 ["Municipalities","(by relationship)","Temporary capacity, strategic initiatives, capital planning, funding","","",""],
 ["Existing Network","(warm relationships)","Highest trust, shortest sales cycle","","",""],
 ],
 [22,24,40,16,14,26],editable_cols=(3,4,5))
ws.cell(row=18,column=1,value="BD principle: don't convince organizations they have a hidden problem — help them solve a known one. Lead with capacity, funding, progress, execution.").font=SUB
ws.cell(row=18,column=1).alignment=WRAP; ws.merge_cells("A18:F19")

# ---- LESSONS LEARNED ----
ws=tab("Lessons Learned","Lessons Learned · AI for Impact","People buy outcomes. The methodology matters, but outcomes drive the purchasing decision.")
table(ws,4,
 ["What we thought they wanted","What they actually want"],
 [
 ["AI","Capacity"],
 ["Innovation","Funding"],
 ["Readiness","Progress"],
 ["Transformation","Execution"],
 ],
 [40,40])
ws.cell(row=10,column=1,value="Key insight: lead with the known problem, not a hidden one. The method (Institutional Stewardship) is how we deliver — outcomes are why they buy.").font=SEC
ws.cell(row=10,column=1).alignment=WRAP; ws.merge_cells("A10:B11")

# ---- THE PROMISE ----
ws=tab("The Promise","The PublicLogic Promise",None)
proms=[
 "PublicLogic is not in the business of producing reports.",
 "PublicLogic is not in the business of producing plans that sit on shelves.",
 "PublicLogic is in the business of helping organizations move important work forward — while ensuring the knowledge, systems, and structures required to sustain that work remain intact.",
 "",
 "Internal strategic principle:",
 "The market buys project delivery. PublicLogic delivers Institutional Stewardship. Both statements are true. Neither should be sacrificed for the other.",
]
r=4
for p in proms:
    c=ws.cell(row=r,column=1,value=p)
    c.font=SEC if p.endswith("principle:") else (Font(size=13,color=SLATE) if p else Font())
    c.alignment=WRAP; r+=1
ws.column_dimensions["A"].width=110
for rr in range(4,r): ws.row_dimensions[rr].height=30

out=os.path.join(os.path.dirname(os.path.abspath(__file__)),"final_deck","PublicLogic - Capabilities Workbook (v2.0 2026-06).xlsx")
os.makedirs(os.path.dirname(out),exist_ok=True)
wb.save(out); print("wrote",out,"| tabs:",wb.sheetnames)
