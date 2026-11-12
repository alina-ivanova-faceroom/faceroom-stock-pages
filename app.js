"use strict";
const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat("ru-RU", {maximumFractionDigits: 2});
const money = new Intl.NumberFormat("ru-RU", {style:"currency",currency:"RUB",maximumFractionDigits:0});
const dateFmt = new Intl.DateTimeFormat("ru-RU", {timeZone:"Europe/Moscow",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const bytes = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
let data = null, tab = "orders", page = 0, sortKey = "order", descending = true;
let turnoverKeys = new Set();
let visibleRows = [], activeFields = [];
const size = 100;
const configs = {
  orders:{title:"Заказы",sub:"Всё, что нужно заказать к следующему периоду.",table:"Потребность в закупке",note:"Заказ = расход за 14 завершённых дней − остаток, с округлением вверх до упаковки. Отрицательный остаток принимается за ноль и требует проверки учёта.",fields:[["branch","Филиал"],["kind","Склад"],["title","Товар"],["article","Артикул"],["demand","Расход, уп"],["stock","Остаток, уп"],["order","К заказу, уп"],["days","Дней запаса"],["flag","Проверить"]]},
  stock:{title:"Остатки",sub:"Товары и расходники по каждому филиалу сети.",table:"Остатки по филиалам",note:"Все значения приведены к упаковкам. Товары и расходники показаны отдельно; отрицательные остатки сохранены для проверки учёта."},
  turnover:{title:"Оборачиваемость",sub:"Скорость расхода, запас в днях и позиции без движения.",table:"Движение товаров",note:"Расчёт по 45 завершённым дням для товаров и расходников. Охват ограничен выбранными категориями брендов. ∞ означает отсутствие положительного расхода.",fields:[["branch","Филиал"],["kind","Склад"],["title","Товар"],["article","Артикул"],["stock","Остаток, уп"],["consumption","Расход, уп"],["perDay","Уп/день"],["days","Дней запаса"],["turns","Оборот/год"],["flag","Проверить"]]},
  cost:{title:"Стоимость склада",sub:"Остатки в деньгах — по месяцам, брендам и филиалам.",table:"Стоимость остатков",note:"Исторические остатки оцениваются по текущим закупочным ценам. Текущий месяц — промежуточный результат на дату обновления. Comfort Zone и Eclado учитываются только на складе расходников.",fields:[["branch","Филиал"],["kind","Склад"],["brand","Бренд"],["month","Месяц"],["cost","Стоимость, ₽"]]}
};
function option(select, value, label) { const o=document.createElement("option");o.value=value;o.textContent=label;select.append(o); }
function populate(id, values, all) { const el=$(id); el.replaceChildren();if(all)option(el,"",all);for(const value of values)option(el,value,value); }
function hasTurnover(row) {return !!row&&turnoverKeys.has(JSON.stringify([row.branchId,row.goodId,row.kind]));}
function numberText(value, key, row) {if(value===null||value===undefined)return key==="days"&&(tab==="turnover"||hasTurnover(row))?"∞":"—";return typeof value==="number"?(key==="cost"?money.format(value):fmt.format(value)):String(value);}
function save(name, raw, type) {const url=URL.createObjectURL(new Blob([raw],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function stockMatrix(rows) {
  const branches=data.branches.filter(b=>!$("branch").value||b.name===$("branch").value);
  const groups=new Map();
  for(const row of rows){const key=JSON.stringify([row.kind,row.article||row.title.toLocaleLowerCase("ru")]);let group=groups.get(key);if(!group){group={kind:row.kind,category:row.category,title:row.title,article:row.article,total:0};for(const b of branches)group["b"+b.id]=0;groups.set(key,group);}group["b"+row.branchId]=(group["b"+row.branchId]||0)+row.stock;group.total+=row.stock;}
  activeFields=[["kind","Склад"],["category","Категория"],["title","Товар"],["article","Артикул"],...branches.map(b=>["b"+b.id,b.name]),["total","Всего, уп"]];
  return [...groups.values()];
}
function render(){
  if(!data)return;
  const cfg=configs[tab];
  const search=$("search").value.trim().toLocaleLowerCase("ru");
  let rows=data[tab].filter(row=>(!$("branch").value||row.branch===$("branch").value)&&(!$("kind").value||row.kind===$("kind").value)&&(tab==="cost"?(!$("month").value||row.month===$("month").value):(!$("category").value||row.category===$("category").value))&&(!search||[row.title,row.article,row.brand,row.category].some(x=>String(x||"").toLocaleLowerCase("ru").includes(search))));
  if(tab==="stock")rows=stockMatrix(rows);else activeFields=cfg.fields;
  rows.sort((a,b)=>{let av=a[sortKey],bv=b[sortKey];if(sortKey==="days"){av=av??Infinity;bv=bv??Infinity;}let cmp=typeof av==="number"&&typeof bv==="number"?(av===bv?0:av>bv?1:-1):String(av??"").localeCompare(String(bv??""),"ru",{numeric:true});return descending?-cmp:cmp;});
  visibleRows=rows;
  page=Math.min(page,Math.max(0,Math.ceil(rows.length/size)-1));
  const head=document.createElement("tr");
  for(const [key,label]of activeFields){const th=document.createElement("th");th.scope="col";if(sortKey===key)th.setAttribute("aria-sort",descending?"descending":"ascending");const button=document.createElement("button");button.textContent=label+(sortKey===key?(descending?" ↓":" ↑"):"");button.onclick=()=>{descending=sortKey===key?!descending:false;sortKey=key;page=0;render();};th.append(button);head.append(th);}
  $("thead").replaceChildren(head);
  const body=document.createDocumentFragment();
  for(const row of rows.slice(page*size,(page+1)*size)){const tr=document.createElement("tr");for(const[key]of activeFields){const td=document.createElement("td");td.textContent=numberText(row[key],key,row);if(key==="title")td.classList.add("product");if(typeof row[key]==="number")td.classList.add("number");if(key==="order")td.classList.add("order");if(key==="flag"&&row[key])td.classList.add("warning");if(typeof row[key]==="number"&&row[key]<0)td.classList.add("negative");tr.append(td);}body.append(tr);}
  if(!rows.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=activeFields.length;td.className="empty";td.textContent="Нет позиций по выбранным условиям";tr.append(td);body.append(tr);}
  $("tbody").replaceChildren(body);
  $("row-count").textContent=rows.length?`${page*size+1}–${Math.min((page+1)*size,rows.length)} из ${fmt.format(rows.length)} позиций`:"0 позиций";
  $("page-number").textContent=`${page+1} / ${Math.max(1,Math.ceil(rows.length/size))}`;
  $("prev").disabled=page===0;$("next").disabled=(page+1)*size>=rows.length;
  const periods=tab==="orders"?data.periods.orders:tab==="turnover"?data.periods.turnover:null;
  $("period").textContent=periods?`Расход за ${periods[0]} — ${periods[1]} · остатки на момент обновления`:tab==="cost"?"Оценка по текущим закупочным ценам · ₽":"Остатки в упаковках · в колонках указаны адреса филиалов";
}
function changeTab(name){
  tab=name;page=0;sortKey=tab==="orders"?"order":tab==="cost"?"cost":tab==="turnover"?"days":"title";descending=tab!=="stock";
  for(const button of $("tabs").querySelectorAll("button")){if(button.dataset.tab===tab)button.setAttribute("aria-current","page");else button.removeAttribute("aria-current");}
  const cfg=configs[tab];$("report-title").textContent=cfg.title;$("report-description").textContent=cfg.sub;$("table-title").textContent=cfg.table;$("report-note").textContent=cfg.note;
  $("month-filter").hidden=tab!=="cost";$("category-filter").hidden=tab==="cost";
  populate("category",[...new Set(data[tab].map(r=>r.category).filter(Boolean))].sort(),"Все категории");
  render();
}
function openDashboard(payload){
  if(payload.schemaVersion!==1||!["orders","stock","turnover","cost"].every(key=>Array.isArray(payload[key])))throw new Error("Неподдерживаемый формат отчётов");
  data=payload;
  turnoverKeys=new Set(data.turnover.map(row=>JSON.stringify([row.branchId,row.goodId,row.kind])));
  document.title=data.title;$("login").hidden=true;$("dashboard").hidden=false;$("password").value="";
  populate("branch",data.branches.map(b=>b.name),"Все филиалы");
  const months=[...(data.months||new Set(data.cost.map(r=>r.month)))].sort().reverse();populate("month",months,"Все месяцы");$("month").value=months[0]||"";
  $("demo-banner").hidden=!data.demo;$("stale-banner").hidden=(Date.now()-new Date(data.updatedAt).getTime())<=8*86400000;
  $("updated").textContent="Срез: "+dateFmt.format(new Date(data.updatedAt))+" МСК";
  $("metric-order").textContent=fmt.format(data.orders.reduce((s,r)=>s+r.order,0));
  $("metric-cost").textContent=money.format(data.cost.filter(r=>r.month===months[0]).reduce((s,r)=>s+r.cost,0));
  $("metric-check").textContent=fmt.format(data.stock.filter(r=>r.stock<0).length);
  $("metric-branches").textContent=data.branches.length;$("order-count").textContent=data.orders.length;
  const unknown=(data.quality||[]).reduce((s,r)=>s+(r.unknownGoodsTransactions||0),0);
  const unlinked=(data.quality||[]).reduce((s,r)=>s+(r.unlinkedTransactions||0),0);
  const notes=[];
  if(unknown)notes.push(`Операций с товарами вне текущего справочника: ${fmt.format(unknown)}.`);
  if(unlinked)notes.push(`Исторических операций без привязки к товару или складу: ${fmt.format(unlinked)}.`);
  if(notes.length)notes.push("Эти операции не включены в расчёт. Для точной сверки истории проверьте их привязки в YCLIENTS.");
  $("quality-note").hidden=!notes.length;$("quality-note").textContent=notes.join(" ");
  changeTab("orders");
}
$("login-form").addEventListener("submit",async event=>{
  event.preventDefault();$("login-error").textContent="";$("enter").disabled=true;$("enter").textContent="Открываем отчёты…";
  try{
    if(!globalThis.crypto?.subtle)throw new Error("Для входа откройте страницу по HTTPS или через localhost.");
    const response=await fetch("data.enc.json",{cache:"no-store"});if(!response.ok)throw new Error("Файл отчётов пока недоступен. Проверьте первый запуск обновления.");
    const blob=await response.json();if(blob.version!==1||blob.iterations!==600000)throw new Error("Неподдерживаемый формат файла отчётов.");
    const material=await crypto.subtle.importKey("raw",new TextEncoder().encode($("password").value),"PBKDF2",false,["deriveKey"]);
    const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:bytes(blob.salt),iterations:blob.iterations,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["decrypt"]);
    const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(blob.iv),additionalData:new TextEncoder().encode("faceroom-stock:v1")},key,bytes(blob.ciphertext));
    openDashboard(JSON.parse(new TextDecoder().decode(plain)));
  }catch(error){$("login-error").textContent=error.name==="OperationError"?"Пароль не подошёл или файл отчётов повреждён.":error.message||"Не удалось открыть отчёты.";}
  finally{$("enter").disabled=false;$("enter").textContent="Открыть отчёты ↗";}
});
$("reveal").onclick=()=>{const show=$("password").type==="password";$("password").type=show?"text":"password";$("reveal").textContent=show?"Скрыть":"Показать";$("reveal").setAttribute("aria-label",show?"Скрыть пароль":"Показать пароль");};
$("tabs").addEventListener("click",event=>{const target=event.target.closest("button[data-tab]");if(target)changeTab(target.dataset.tab);});
for(const id of ["branch","kind","category","month"]){$(id).addEventListener("change",()=>{page=0;render();});}
$("search").addEventListener("input",()=>{page=0;render();});
$("prev").onclick=()=>{page--;render();};$("next").onclick=()=>{page++;render();};
$("download-excel").onclick=()=>save("FaceRoom-склад-"+data.updatedAt.slice(0,10)+".xlsx",bytes(data.excel),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
$("download-csv").onclick=()=>{const escape=value=>{let text=String(value??"");if(typeof value!=="number"&&/^[\s]*[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};const lines=[activeFields.map(([,label])=>escape(label)).join(";"),...visibleRows.map(row=>activeFields.map(([key])=>escape(row[key]===null?(key==="days"&&(tab==="turnover"||hasTurnover(row))?"∞":""):row[key])).join(";"))];save("FaceRoom-"+tab+".csv","\uFEFF"+lines.join("\r\n"),"text/csv;charset=utf-8");};
$("logout").onclick=()=>{data=null;turnoverKeys.clear();visibleRows=[];$("tbody").replaceChildren();$("dashboard").hidden=true;$("login").hidden=false;$("password").value="";$("password").type="password";$("reveal").textContent="Показать";$("login-error").textContent="";$("password").focus();};
